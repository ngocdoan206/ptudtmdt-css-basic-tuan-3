/* NGUYỆT THẠCH – hiệu ứng dùng chung cho 3 trang (jQuery) */
$(function () {
    var $win = $(window);
    var $header = $('.site-header');

    // 1. Navbar thu nhỏ + ẩn thanh khuyến mãi khi cuộn
    //    Dùng 2 ngưỡng khác nhau (xuống quá 80px mới thu, lên dưới 20px mới mở lại)
    //    để header không bật/tắt liên tục khi dừng cuộn quanh một vị trí.
    function onScroll() {
        var y = $win.scrollTop();
        if (y > 80) $header.addClass('scrolled');
        else if (y < 20) $header.removeClass('scrolled');
        revealOnScroll();
    }

    // 2. Hiện dần các khối khi cuộn tới + chạy thanh kho từ 0%
    function inView($el) {
        var top = $el.offset().top;
        return top < $win.scrollTop() + $win.height() - 60;
    }
    function revealOnScroll() {
        $('.reveal:not(.show)').each(function () {
            if (inView($(this))) $(this).addClass('show');
        });
        $('[data-stock]:not(.done), [data-order]:not(.done)').each(function () {
            var $bar = $(this);
            if (inView($bar)) {
                $bar.addClass('done').css('width', ($bar.data('stock') || $bar.data('order')) + '%');
            }
        });
    }
    $win.on('scroll resize', onScroll);
    onScroll();

    // 3. Màu thanh kho theo lượng hàng: ≤30% đỏ son, 30–70% vàng, >70% xanh
    $('[data-stock]').each(function () {
        var p = parseInt($(this).data('stock'), 10);
        $(this).addClass(p <= 30 ? 'progress-bar-danger' : p <= 70 ? 'progress-bar-warning' : 'progress-bar-success')
               .attr({ role: 'progressbar', 'aria-valuenow': p, 'aria-valuemin': 0, 'aria-valuemax': 100 });
    });

    // 4. Sao đánh giá chỉ để hiển thị (bootstrap-star-rating, giao diện SVG – không dùng glyphicon-star)
    $('.rating-display').rating({
        theme: 'krajee-svg', displayOnly: true, size: 'xs', step: 0.1,
        showCaption: false, showClear: false
    });

    // 5. Giỏ hàng: lưu số lượng trong localStorage để giữ qua các trang
    function getCart() {
        try { return parseInt(localStorage.getItem('nt_cart'), 10) || 0; } catch (e) { return 0; }
    }
    function setCart(n) {
        try { localStorage.setItem('nt_cart', n); } catch (e) {}
        $('.cart-badge').text(n).removeClass('bump');
        void $('.cart-badge')[0].offsetWidth;   // chạy lại hiệu ứng nảy
        $('.cart-badge').addClass('bump');
    }
    $('.cart-badge').text(getCart());

    var toastTimer;
    window.ntToast = function (html) {
        var $t = $('.nt-toast');
        if (!$t.length) $t = $('<div class="nt-toast" role="status"></div>').appendTo('body');
        $t.html(html).addClass('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { $t.removeClass('show'); }, 2600);
    };

    $(document).on('click', '.add-to-cart', function (e) {
        e.preventDefault();
        var qty = parseInt($('#qty').val(), 10);
        if ($(this).data('use-qty') !== true || isNaN(qty) || qty < 1) qty = 1;
        setCart(getCart() + qty);
        ntToast('Đã thêm <b>' + $(this).data('name') + '</b> × ' + qty + ' vào giỏ');
    });

    // 6. Đăng ký nhận tin
    $('.newsletter form').on('submit', function (e) {
        e.preventDefault();
        var email = $.trim($(this).find('input').val());
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            ntToast('Email chưa đúng định dạng, nàng kiểm tra lại nhé');
            return;
        }
        $(this).find('input').val('');
        ntToast('Cảm ơn nàng! Ưu đãi <b>-10%</b> đã gửi tới ' + email);
    });

    // 7. Carousel: chỉ phát video của slide đang hiện
    $('#heroCarousel').on('slid.bs.carousel', function () {
        $(this).find('video').each(function () { this.pause(); });
        var v = $(this).find('.item.active video')[0];
        if (v) { v.currentTime = 0; v.play(); }
    });

    $('.track-btn').on('click', function (e) {
        e.preventDefault();
        ntToast('Shipper đang cách nàng <b>2,4 km</b> – dự kiến tới lúc 16:30');
    });

    $('.year').text(new Date().getFullYear());
});
