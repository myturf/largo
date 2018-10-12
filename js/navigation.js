(function() {
  var $ = jQuery;

  var Navigation = function() {
    this.scrollTop = $(window).scrollTop();
    this.previousScroll = null;
    this.initialLoad = true;
    return this.init();
  };

  /*
   * This is a shim to cover for the case where a browser may or may not have scrollbars
   * @link https://github.com/jquery/jquery/issues/1729
   * @link https://github.com/INN/largo/pull/1369
   */
  Navigation.prototype.windowwidth = function() {
    return Math.max(window.outerWidth, $(window).width());
  }

  /**
   * Set up the Navigation object
   */
  Navigation.prototype.init = function() {
    // Dropdowns on touch screens
    this.enableMobileDropdowns();
    this.toggleTouchClass();

    // Stick navigation
    this.stickyNavEl = $('.sticky-nav-holder');
    this.stickyNavWrapper = $('.sticky-nav-wrapper');
    this.mainEl = $('#main');
    this.mainNavEl = $('#main-nav');

    // the currently-open menu Element (not a jQuery object);
    this.openMenu = false;

    if (this.windowwidth() > 768) {
      this.stickyNavTransition();
    }

    // Bind events
    this.bindEvents();

    // Deal with long/wrapping navs
    setTimeout(this.navOverflow.bind(this), 0);

    // Nav on small viewports
    this.responsiveNavigation();

    // Nav on touch devices on large viewports
    this.touchDropdowns();

    return this;
  };

  /**
   * Run the Modernizr.touch and Modernizr.pointerevents tests at will
   *
   * because Modernizr doesn't allow rerunning the tests, so the availablilty of an input device changes while the page is loaded, the Modernizr.touch property will be inaccurate
   *
   * @link https://github.com/Modernizr/Modernizr/blob/e2c27dcd32d6185846ce3c6c83d7634cfa402d19/feature-detects/touchevents.js
   * @link https://github.com/Modernizr/Modernizr/blob/e2c27dcd32d6185846ce3c6c83d7634cfa402d19/feature-detects/pointerevents.js
   * @return bool whether or not this is (probably) a touch device at this time
   */
  Navigation.prototype.touch = function () {
    if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
      return true;
    }

    domPrefixes = Modernizr._domPrefixes;
    var bool = false,
           i = domPrefixes.length;

    // Don't forget un-prefixed...
    bool = Modernizr.hasEvent('pointerdown');

    while (i-- && !bool) {
      if (hasEvent(domPrefixes[i] + 'pointerdown')) {
        bool = true;
      }
    }
    return bool;
  }

  /**
   * If a nav dropdown element is open, and something outside is clicked, close the menu
   */
  Navigation.prototype.enableMobileDropdowns = function () {
    var self = this;

    // Call this to close the open menu
    var closeOpenMenu = function(event) {
      // If it is a touch event, get rid of the click events.
      if (event.type == 'touchstart') {
        $(this).off('click.touchDropdown');
      }

      if (self.openMenu) {
        self.openMenu.parentNode.classList.remove('open');
        self.openMenu = false;
        // we can't event.preventDefault here because of Chrome/Opera:
        // https://www.chromestatus.com/feature/5093566007214080
      }
    }

    // Close the open menu when the user taps elsewhere
    // Should this be scoped to not be on document/html/body?
    // No; because #page and div.footer-bg
    $('body').on('touchstart.touchDropdown click.touchDropdown' , closeOpenMenu);
  };

  /**
   * Toggle the Modernizr-added .touch and .no-touch classes
   */
  Navigation.prototype.toggleTouchClass = function () {
    $html = $('html');
    if (this.touch()) {
      $html.addClass('touch').removeClass('no-touch');
    } else {
      $html.addClass('no-touch').removeClass('touch');
    }
  }

  Navigation.prototype.bindEvents = function() {
    $(window).resize(this.navOverflow.bind(this));
    $(window).resize(this.enableMobileDropdowns.bind(this));
    $(window).resize(this.toggleTouchClass.bind(this));
    this.bindStickyNavEvents();
  };

  /**
   * Attach sticky nav resize event handlers to their events
   */
  Navigation.prototype.bindStickyNavEvents = function() {
    var self = this;

    // This is so that we may apply styles to the navbar based on what options are set
    // This is used with some styles in less/inc/navbar-sticky.less
    $.each(Largo.sticky_nav_options, function(idx, opt) {
      if (opt)
        self.stickyNavEl.addClass(idx);
    });

    $(window).on('scroll', this.stickyNavScrollCallback.bind(this));
    $(window).on('resize', this.stickyNavResizeCallback.bind(this));

    this.stickyNavResizeCallback();
    this.stickyNavSetOffset();
  };

  /**
   * Hide the sticky nav if we're too close to the top of the page
   */
  Navigation.prototype.stickyNavScrollTopHide = function() {
    if ($(window).scrollTop() <= this.mainEl.offset().top && this.mainNavEl.is(':visible')) {
      this.stickyNavEl.removeClass('show');
      clearTimeout(this.scrollTimeout);
      return;
    }
  }

  Navigation.prototype.stickyNavResizeCallback = function() {
    if (
      this.windowwidth() <= 768 ||
      (Largo.sticky_nav_options.main_nav_hide_article && ($('body').hasClass('single') || $('body').hasClass('page')))
   ) {
      this.stickyNavEl.addClass('show');
      this.stickyNavEl.parent().css('height', this.stickyNavEl.outerHeight());
    } else if (
      Largo.sticky_nav_options.sticky_nav_display
   ) {
      this.stickyNavScrollTopHide();
      this.stickyNavEl.parent().css('height', '');
    } else {
      this.stickyNavEl.parent().css('height', '');
    }
    this.stickyNavSetOffset();
    this.stickyNavTransitionDone();
  };

  Navigation.prototype.stickyNavScrollCallback = function(event) {
    if ($(window).scrollTop() < 0 || ($(window).scrollTop() + $(window).outerHeight()) >= $(document).outerHeight()) {
      return;
    }

    var self = this,
        direction = this.scrollDirection(),
        callback, wait;

    this.stickyNavScrollTopHide();

    this.stickyNavSetOffset();

    // Abort if the scroll direction is the same as it was, or if the page has not been scrolled.
    if (this.previousScroll == direction || !this.previousScroll) {
      this.previousScroll = direction;
      return;
    }

    clearTimeout(this.scrollTimeout);

    if (direction == 'up') {
      callback = this.stickyNavEl.addClass.bind(this.stickyNavEl, 'show'),
      wait = 250;
    } else if (direction == 'down') {
      callback = this.stickyNavEl.removeClass.bind(this.stickyNavEl, 'show');
      wait = 500;
    }

    this.scrollTimeout = setTimeout(callback, wait);
    this.previousScroll = direction;
  };

  Navigation.prototype.scrollDirection = function() {
    var scrollTop = $(window).scrollTop(),
        direction;

    if (scrollTop > this.scrollTop)
      direction = 'down';
    else
      direction = 'up';

    this.scrollTop = scrollTop;
    return direction;
  };

  Navigation.prototype.stickyNavSetOffset = function() {
    if ($('body').hasClass('admin-bar')) {
      if ($(window).scrollTop() <= $('#wpadminbar').outerHeight()) {
        this.stickyNavEl.css('top', $('#wpadminbar').outerHeight());
      } else {
        this.stickyNavEl.css('top', '');
      }
    }
  };

  /**
   * Touch/click event handler for sticky nav and main nav items
   *
   * Goals:
   * - open when tapped, event.preventDefault
   * - when open, click on link follows that link
   *
   * Largo does not support a three-level menu, so no need to worry about dropdowns off the dropdown.
   *
   * @todo: prevent this from triggering on the mobile nav
   */
  Navigation.prototype.touchDropdowns = function() {
    var self = this;
    // a selector that applies to both main-nav and sticky nav elements
    $('.nav li > .dropdown-toggle').each(function() {
      var $button = $(this);

      // Open the drawer when touched or clicked
      function touchstart(event) {
        // prevents this from running when the sandwich menu button is visible:
        // prevents this from running when we're doing the "phone" menu
        if ($('.navbar .toggle-nav-bar').css('display') !== 'none') {
          return false;
        }

        if ($(this).parent('.dropdown').hasClass('open')) {
          console.log('doing nothing');
        } else {
          // If it is a touch event, get rid of the click events.
          if (event.type == 'touchstart') {
            $(this).off('click.toggleNav');
          }
          $(this).parent('.dropdown').addClass('open');
          $(this).parent('.dropdown').addClass('open');
          console.log('opening', $(this).parent('.dropdown'));
          self.openMenu = this;
          event.preventDefault();
        }
      }

      // if the touch is canceled, close the nav
      function touchcancel(event) {
        console.log('touchcancel');
        $(this).parent('.dropdown').removeClass('open');
      }

      $button.on('touchstart.toggleNav click.toggleNav', touchstart);
      $button.on('touchcancel.toggleNav', touchcancel);
    });
  }

  /**
   * Touch menu interactions and menu appearance on "phone" screen sizes.
   */
  Navigation.prototype.responsiveNavigation = function() {
    var self = this;

    // Tap/click this button to open/close the phone navigation, which shows on narrower viewports
    $('.navbar .toggle-nav-bar').each(function() {
      // the hamburger
      var toggleButton = $(this),
        // the parent nav of the hamburger
        navbar = toggleButton.closest('.navbar');

      // Support both touch and click events
      // The .toggleNav here is namespacing the click event: https://api.jquery.com/on/#event-names
      toggleButton.on('touchstart.toggleNav click.toggleNav', function(event) {
        // If it is a touch event, get rid of the click events.
        if (event.type == 'touchstart') {
          toggleButton.off('click.toggleNav');
        }

        navbar.toggleClass('open');
        $('html').addClass('nav-open');
        self.stickyNavSetOffset();
        navbar.find('.nav-shelf').css({
          top: self.stickyNavEl.position().top + self.stickyNavEl.outerHeight()
        });

        if (!navbar.hasClass('open')) {
          navbar.find('.nav-shelf li.open').removeClass('open');
          $('html').removeClass('nav-open');
        }

        return false;
      });

      // Secondary nav items in the drop-down
      navbar.on('touchstart.toggleNav click.toggleNav', '.nav-shelf .caret', function(event) {
        // prevents this from running when the sandwich menu button is not visible:
        // prevents this from running when we're not doing the "phone" menu
        if (toggleButton.css('display') == 'none') {
          return false;
        }

        if (event.type == 'touchstart') {
          navbar.off('click.toggleNav', '.nav-shelf .dropdown-toggle');
        }

        var li = $(event.target).closest('li');

        if (!li.hasClass('open')) {
          navbar.find('.nav-shelf li.open').removeClass('open');
        }

        li.toggleClass('open');
        return false;
      });
    });
  };

  /**
   * On window resize, make sure nav doesn't overflow.
   * Put stuff in the overflow nav if it does.
   *
   * Event should fire enough that we can do one at a time
   * and be ok.
   *
   * @since Largo 0.5.1
   */
  Navigation.prototype.navOverflow = function() {
    var nav = $('#sticky-nav');

    if (!nav.is(':visible') || this.windowwidth() <= 768) {
      this.revertOverflow();
      return;
    }

    if (! this.windowwidth() <= 768) {
      $('html').removeClass('nav-open');
    }

    var shelf = nav.find('.nav-shelf'),
        button = nav.find('.toggle-nav-bar'),
        right = nav.find('.nav-right'),
        shelfWidth = shelf.outerWidth(),
        rightWidth = right.outerWidth(),
        caretWidth = nav.find('.caret').first().outerWidth(),
        windowWidth = this.windowwidth(),
        isMobile = button.is(':visible');

    if (!isMobile) {
      if (!this.stickyNavEl.hasClass('transitioning')) {
        this.stickyNavTransition();
      }

      /*
       * Calculate the width of the nav
       */
      var navWidth = 0;
      shelf.find('ul.nav > li').each(function() {
        if ($(this).is(':visible'))
          navWidth += $(this).outerWidth();
      });

      var overflow = shelf.find('ul.nav > li#menu-overflow.menu-item-has-children').last();

      if (!isMobile && navWidth > shelfWidth - rightWidth - caretWidth) {
        /*
         * If there is no "overflow" menu item, create one
         *
         * This is where you change the word from "More" to something else.
         */
        if (overflow.length == 0) {
          var overflowmenu ='<li id="menu-overflow" class="menu-item-has-children dropdown">' +
            '<a href="#" class="dropdown-toggle">' + Largo.sticky_nav_options.nav_overflow_label + '<b class="caret"></b></a>' +
            '<ul id="sticky-nav-overflow" class="dropdown-menu"></ul></li>';
          overflow = $(overflowmenu);
          overflow.find('a').click(function() { return false; });
          shelf.find('ul.nav > li.menu-item').last().after(overflow);
        }

        var li = shelf.find('ul.nav > li.menu-item').last();

        overflow.find('ul#sticky-nav-overflow').prepend(li);
        li.addClass('overflowed');
        li.data('shelfwidth', shelfWidth);
      } else if (overflow.length) {
        /*
         * Put items back on the main sticky menu and empty out the overflow nav menu if necessary.
         */
        var li = overflow.find('li').first();

        if (li.hasClass('overflowed')) {
          if (li.data('shelfwidth') < shelfWidth) {
            shelf.find('ul.nav > li.menu-item').last().after(li);

            // Remove the "More" menu if there are no items in it.
            if (overflow.find('ul li').length == 0) {
              overflow.remove();
            }
          }
        }
      }

      /*
       * Re-calculate the width of the nav after adding/removing overflow items.
       *
       * If the nav is still wrapping, call navOverflow again.
       */
      var navWidth = 0;
      shelf.find('ul.nav > li').each(function() {
        if ($(this).is(':visible'))
          navWidth += $(this).outerWidth();
      });
      shelfWidth = shelf.outerWidth(),
      rightWidth = right.outerWidth();

      if (!isMobile && navWidth > shelfWidth - rightWidth - caretWidth) {
        if (typeof this.navOverflowTimeout !== 'undefined')
          clearTimeout(this.navOverflowTimeout);
        this.navOverflowTimeout = setTimeout(this.navOverflow.bind(this), 0);
        return;
      }
    }

    this.stickyNavTransitionDone();
  };

  Navigation.prototype.stickyNavTransition = function() {
    if (!this.stickyNavEl.hasClass('transitioning')) {
      this.stickyNavEl.addClass('transitioning');
    }
  };

  Navigation.prototype.stickyNavTransitionDone = function() {
    var self = this;

    if (typeof this.stickyNavTransitionTimeout !== 'undefined')
      clearTimeout(this.stickyNavTransitionTimeout);

    this.stickyNavTransitionTimeout = setTimeout(function() {
      if (self.stickyNavEl.hasClass('transitioning'))
        self.stickyNavEl.removeClass('transitioning');
    }, 500);
  };

  Navigation.prototype.revertOverflow = function() {
    var nav = $('#sticky-nav'),
        self = shelf = nav.find('.nav-shelf'),
        overflow = shelf.find('ul.nav > li#menu-overflow.menu-item-has-children').last();

    overflow.find('li.overflowed').each(function(idx, li) {
      shelf.find('ul.nav > li.menu-item').last().after(li);
    });

    if (overflow.find('ul li').length == 0) {
      overflow.remove();
    }
  };

  if (typeof window.Navigation == 'undefined')
    window.Navigation = Navigation;

  /**
   * Initialize the Navigation
   */
  $(document).ready(function() {
    // make this Navigation available to inspectors.
    window.Largo.navigation = new Navigation();
  });
})();
