$(function () {
    // ===== 1. Khai báo các object =====
    var container = $('#container');
    var bird      = $('#bird');
    var pole      = $('.pole');
    var pole_1    = $('#pole_1');
    var pole_2    = $('#pole_2');
    var score     = $('#score');
    var level_box = $('#level');
    var best_box  = $('#best');
    var message   = $('#message');

    // ===== 2. Thông số (đổi sang số) =====
    var container_width       = container.innerWidth();
    var container_height      = container.innerHeight();
    var pole_initial_position = parseInt(pole.css('right'));
    var pole_initial_height   = parseInt(pole.css('height'));
    var bird_left             = parseInt(bird.css('left'));
    var bird_height           = bird.outerHeight();
    var bird_start_top        = parseInt(bird.css('top'));
    var speed                 = 10; // Tốc độ di chuyển ống mỗi nhịp

    // ===== 3. Level theo đề =====
    // Level 1: 40ms, Level 2 (5 điểm): 30ms, Level 3 (20 điểm): 25ms, Level 4 (40 điểm): 20ms
    var LEVEL_INTERVAL = { 1: 40, 2: 30, 3: 25, 4: 20 };
    var WIN_SCORE = 50;
    var level = 1;

    // ===== 4. Trạng thái game =====
    var the_game = null;     // Lưu setInterval để dừng được (bản gốc bị lỗi chỗ này)
    var go_up = false;       // Đang giữ phím ↓ hay không
    var score_updated = false;
    var game_over = false;
    var paused = false;

    // Nâng cao: chuyển động theo vận tốc để chim bay mượt
    var bird_top = bird_start_top;
    var velocity = 0;
    var GRAVITY = 0.9, LIFT = 2.2, MAX_FALL = 8, MAX_RISE = -7;

    // Nâng cao: lưu kỷ lục trên trình duyệt
    var best = 0;
    try { best = parseInt(localStorage.getItem('flappy_best')) || 0; } catch (e) {}
    best_box.text('Kỷ lục: ' + best);

    // ===== 5. Vòng lặp game =====
    function startLoop() {
        clearInterval(the_game);
        the_game = setInterval(tick, LEVEL_INTERVAL[level]);
    }

    function tick() {
        // Va chạm ống trên, ống dưới, mép trên hoặc mép dưới khung game
        if (collision(bird, pole_1, 6) ||
            collision(bird, pole_2, 6) ||
            bird_top <= 0 ||
            bird_top > container_height - bird_height) {
            stop_the_game(false);
            return;
        }

        var pole_current_position = parseInt(pole.css('right'));

        // Chim vượt qua 1 cặp ống thì cộng điểm (mỗi cặp chỉ cộng 1 lần)
        if (pole_current_position > container_width - bird_left && score_updated === false) {
            score_updated = true;
            addPoint();
            if (game_over) return; // Đủ 50 điểm thì dừng luôn
        }

        // Ống ra khỏi khung thì đưa về bên phải với chiều cao ngẫu nhiên
        if (pole_current_position > container_width) {
            var new_height = Math.floor(Math.random() * 161) - 80; // -80 .. 80
            pole_1.css('height', pole_initial_height + new_height);
            pole_2.css('height', pole_initial_height - new_height);
            score_updated = false;
            pole_current_position = pole_initial_position;
        }

        pole.css('right', pole_current_position + speed);
        moveBird();
    }

    // Giữ ↓ thì vận tốc giảm dần (bay lên), thả ra thì trọng lực kéo xuống
    function moveBird() {
        if (go_up) velocity = Math.max(velocity - LIFT, MAX_RISE);
        else       velocity = Math.min(velocity + GRAVITY, MAX_FALL);
        bird_top += velocity;
        var angle = Math.max(-20, Math.min(velocity * 6, 60));
        bird.css({ top: bird_top, transform: 'rotate(' + angle + 'deg)' });
    }

    // ===== 6. Điểm và Level =====
    function addPoint() {
        var s = parseInt(score.text()) + 1;
        score.text(s);

        if (s >= WIN_SCORE) {
            stop_the_game(true);
            return;
        }

        var new_level = s >= 40 ? 4 : s >= 20 ? 3 : s >= 5 ? 2 : 1;
        if (new_level !== level) {
            level = new_level;
            level_box.text('Level ' + level).removeClass('up');
            void level_box[0].offsetWidth; // chạy lại hiệu ứng
            level_box.addClass('up');
            startLoop(); // Đổi interval theo level mới
        }
    }

    // ===== 7. Bắt đầu / dừng / tạm dừng / chơi lại =====
    function startGame() {
        if (game_over || the_game) return;
        paused = false;
        message.hide();
        $('#play_btn').hide();
        startLoop();
    }

    function stop_the_game(win) {
        clearInterval(the_game); // Sửa lỗi bản gốc: clearInterval(playGame())
        the_game = null;
        game_over = true;
        go_up = false;

        var s = parseInt(score.text());
        if (s > best) {
            best = s;
            best_box.text('Kỷ lục: ' + best);
            try { localStorage.setItem('flappy_best', best); } catch (e) {}
        }

        message.html(win
            ? '🎉 CHIẾN THẮNG!<br>Bạn đạt ' + s + ' điểm'
            : 'Thua rồi! Điểm: ' + s).fadeIn();
        $('#restart_btn').slideDown();
    }

    function togglePause() {
        if (game_over || $('#play_btn').is(':visible')) return;
        if (paused) {
            startGame();
        } else {
            clearInterval(the_game);
            the_game = null;
            paused = true;
            message.text('Tạm dừng – nhấn P để chơi tiếp').fadeIn();
        }
    }

    // Nâng cao: chơi lại không cần tải lại trang
    function resetGame() {
        clearInterval(the_game);
        the_game = null;
        game_over = false;
        paused = false;
        go_up = false;
        score_updated = false;
        level = 1;
        velocity = 0;
        bird_top = bird_start_top;
        score.text(0);
        level_box.text('Level 1').removeClass('up');
        bird.css({ top: bird_top, transform: 'rotate(0deg)' });
        pole.css({ right: pole_initial_position, height: pole_initial_height });
        message.hide();
        $('#restart_btn').hide();
        $('#play_btn').show();
    }

    // ===== 8. Sự kiện: keydown phím ↓ thay cho mousedown =====
    $(document).on('keydown', function (e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();      // Không cho trang cuộn xuống
            go_up = true;
            startGame();
        } else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        } else if (e.key === 'Enter' && game_over) {
            e.preventDefault();
            resetGame();
        }
    });

    // Nhả phím ↓ (thay cho mouseup)
    $(document).on('keyup', function (e) {
        if (e.key === 'ArrowDown') go_up = false;
    });

    // Rời khỏi tab thì coi như đã nhả phím
    $(window).on('blur', function () { go_up = false; });

    $('#play_btn').click(startGame);
    $('#restart_btn').click(resetGame);

    // ===== 9. Hàm va chạm (pad: thu nhỏ vùng va chạm cho công bằng) =====
    function collision($div1, $div2, pad) {
        var x1 = $div1.offset().left + pad;
        var y1 = $div1.offset().top + pad;
        var r1 = $div1.offset().left + $div1.outerWidth() - pad;
        var b1 = $div1.offset().top + $div1.outerHeight() - pad;

        var x2 = $div2.offset().left;
        var y2 = $div2.offset().top;
        var r2 = x2 + $div2.outerWidth();
        var b2 = y2 + $div2.outerHeight();

        return !(b1 < y2 || y1 > b2 || r1 < x2 || x1 > r2);
    }
});