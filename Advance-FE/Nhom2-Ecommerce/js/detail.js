/* NGUYỆT THẠCH – trang chi tiết: xZoom, chọn chất liệu, đánh giá */
$(function () {
    // 1. xZoom: kính lúp tròn đi theo con trỏ, lăn chuột để đổi độ phóng
    $('.xzoom, .xzoom-gallery').xzoom({
        position: 'lens',
        lensShape: 'circle',
        zoomWidth: 480,
        zoomHeight: 480,
        bg: true,
        smoothLensMove: 1,
        smoothZoomMove: 3,
        defaultScale: 0
    });

    // 2. Đổi chất liệu thì cập nhật giá
    var BASE = 34650000, OLD = 38500000;
    function vnd(n) { return n.toLocaleString('vi-VN') + ' ₫'; }
    $('#material').on('change', function () {
        var add = parseInt($(this).val(), 10) || 0;
        $('.detail-price strong').text(vnd(BASE + add));
        $('.detail-price del').text(vnd(OLD + add));
    });

    // 3. Giới hạn số lượng theo tồn kho (tối đa 3)
    $('#qty').on('change', function () {
        var v = parseInt($(this).val(), 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 3) { v = 3; ntToast('Đợt này chỉ còn <b>3</b> sản phẩm'); }
        $(this).val(v);
    });

    $('#contact-seller').on('click', function (e) {
        e.preventDefault();
        ntToast('Tư vấn viên sẽ nhắn cho nàng trong <b>5 phút</b>');
    });

    // 4. Bấm "86 đánh giá" thì mở tab Đánh giá
    $('.go-review').on('click', function (e) {
        e.preventDefault();
        $('a[href="#tab-review"]').tab('show');
        $('html, body').animate({ scrollTop: $('.nt-tabs').offset().top - 90 }, 500);
    });

    // 5. Form đánh giá: chấm sao bằng bootstrap-star-rating
    $('#rv-star').rating({
        theme: 'krajee-svg', size: 'sm', showClear: false,
        starCaptions: { 1: 'Chưa hài lòng', 2: 'Tạm được', 3: 'Ổn', 4: 'Rất thích', 5: 'Tuyệt vời' },
        starCaptionClasses: { 1: 'label label-danger', 2: 'label label-warning', 3: 'label label-default', 4: 'label label-primary', 5: 'label label-success' },
        clearCaption: 'Chưa chấm sao'
    });

    $('#rv-name, #rv-text').on('input', function () { $('#rv-error').hide(); });
    $('#rv-star').on('rating:change', function () { $('#rv-error').hide(); });

    $('#review-form').on('submit', function (e) {
        e.preventDefault();
        var star = parseFloat($('#rv-star').val()) || 0;
        var name = $.trim($('#rv-name').val());
        var text = $.trim($('#rv-text').val());
        if (star === 0 || !name || !text) {
            $('#rv-error').text('Nàng chấm sao, nhập tên và vài dòng cảm nhận giúp Nguyệt Thạch nhé.').show();
            return;
        }
        var today = new Date().toLocaleDateString('vi-VN');
        var $rv = $('<div class="review" style="display:none"></div>')
            .append($('<span class="who"></span>').text(name))
            .append($('<span class="when"></span>').text(today))
            .append('<input class="rating-display" value="' + star + '">')
            .append($('<p></p>').text(text));   // .text() để chống chèn mã HTML
        $('#review-list').prepend($rv);
        $rv.find('.rating-display').rating({ theme: 'krajee-svg', displayOnly: true, size: 'xs', showCaption: false });
        $rv.slideDown(400);
        $('#review-count').text($('#review-list .review').length);
        $('#rv-star').rating('reset');
        this.reset();
        ntToast('Cảm ơn <b>' + $('<i>').text(name).html() + '</b> đã chia sẻ!');
    });
});
