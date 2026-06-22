const fs = require('fs');
const path = require('path');
const { CONVERT_PATTERNS_V2 } = require('../src/convertPatterns.js');

// 20 sentences to validate
const sentences = [
  "Triệu Vân ngây ngốc đứng lặng, kinh ngạc nhìn xem mặc áo cưới Liễu Như Tâm.",
  "Động phòng hoa chúc, hắn ngày đại hỉ.",
  "Như vậy, cái này bị xốc hồng khăn cô dâu nữ tử, không phải của hắn tân nương.",
  "Liễu Như Tâm chui tròng mắt, thân thể lạnh run, nàng con mắt mặc dù thanh tịnh, rồi lại chất phác trống rỗng.",
  "Hoặc là nói, nàng là một cái mù lòa, mắt mù tân nương.",
  "“Hồi đáp vấn đề của ta, vì sao là ngươi, chị của ngươi đâu Liễu Như Nguyệt đâu” Triệu Vân tiếng gầm khàn giọng, trong mắt đã thấy tơ máu.",
  "“Là tỷ ta, để cho ta thay nàng đến đấy.” Liễu Như Tâm sợ hãi, trong mắt nước mắt.",
  "“Nực cười.”",
  "Vong Cổ Thành đêm, có phần là phồn hoa, đại đèn lồng màu đỏ treo trên cao, kiều diễm như hoa, trên đường người đi đường hối hả, không thiếu giang hồ làm xiếc, thôn dầu thổ hỏa, múa thương chuẩn bị bổng, khen ngợi âm thanh liên tiếp.",
  "Như vậy, phần này phồn hoa, rồi lại nguyên nhân một người đi qua, lại thêm một vòng tiếng động lớn náo.",
  "Chính là Triệu Vân, thân mặc chú rể quần áo, tay cầm hàn quang kiếm, tại trên đường đặc biệt bắt mắt.",
  "“Liễu gia đại tiểu thư hạng gì thiên phú, lại vẫn chịu gả hắn cái này người vô dụng.”",
  "“Thật không biết kiếp trước tu nhiều ít phú đức.”",
  "“Ngày đại hỉ, không ở phòng tân hôn cùng Liễu Như Nguyệt chàng chàng thiếp thiếp, chạy ngoài lên làm chi.”",
  "“Như vậy trọng sát khí, ai chọc hắn.”",
  "Trên đường người đi đường ngươi đẩy ta táng, chỉ trỏ, xì xào bàn tán trong rất nhiều tiếc hận, trào phúng, nghi hoặc.",
  "Phía trước, Triệu Vân sát khí quấn thân, khuôn mặt tái nhợt vẫn là mang mấy phần dữ tợn.",
  "Nàng, Liễu Như Nguyệt, Liễu gia đại tiểu thư, gia tộc hòn ngọc quý trên tay, Vong Cổ Thành thiên chi kiều nữ.",
  "Nguyên nhân chính là như thế, môn đăng hộ đối Triệu liễu hai nhà, mới vì hai người đính hôn ước hẹn, làm gì mệnh hắn đồ đa suyễn, rèn luyện lúc bị người ám toán, Triệu Gia hết sức cứu giúp, mặc dù nhặt được tính mạng, rồi lại chặt đứt Linh Mạch.",
  "Không người lại nhìn tốt bọn họ, liền chính hắn đều như vậy cho rằng, ai muốn gả cho một cái phế vật."
];

function applyPatterns(text) {
  let processed = text;
  CONVERT_PATTERNS_V2.forEach(item => {
    const regex = new RegExp(item.pattern, 'gi');
    processed = processed.replace(regex, item.replacement);
  });
  return processed;
}

console.log("=== VALIDATION RESULTS FOR 20 SENTENCES ===");
sentences.forEach((s, idx) => {
  const output = applyPatterns(s);
  console.log(`\nSentence ${idx+1}:`);
  console.log(`  - Original: "${s}"`);
  console.log(`  - Output:   "${output}"`);
  console.log(`  - Is Changed? ${s !== output ? 'YES' : 'NO'}`);
});
