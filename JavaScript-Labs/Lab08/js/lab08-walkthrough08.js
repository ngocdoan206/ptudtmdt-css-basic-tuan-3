// define functions in this file
// biến toàn cục (global): dùng được ở mọi nơi
var boxClass = 'movingDiv';

function outputBox(num) {
   box = "<div class='" + boxClass + "' id='div" + num + "'>";
   box += "This is div " + num;
   box += "</div>";
   return box;
}