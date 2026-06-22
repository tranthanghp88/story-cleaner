const fs = require('fs');
const path = require('path');

const ch0 = fs.readFileSync('scratch/chapter_0_raw.txt', 'utf8');
const ch1 = fs.readFileSync('scratch/chapter_1_raw.txt', 'utf8');
const fullText = ch0 + "\n" + ch1;

const candidates = [
  // Nhóm Ngữ Pháp (Grammar / Syntax / Word Order)
  "chính là",
  "nhượng",
  "vẫn là",
  "có phần là",
  "sớm đã",
  "nhất cái",
  "nhìn xem",
  "hạng gì",
  "nhiều ít",
  "nguyên nhân chính là",
  "hồi đáp vấn đề",
  "trong mắt nước mắt",
  "trong mắt đã thấy tơ máu",
  "sớm đi",
  "bằng không thì",
  "đích xác",
  "đang khi nói chuyện",
  "nhìn tốt bọn họ",
  "bản thân không lấy chồng",
  "đến thời khắc này",
  "chúng nhân",
  "khó làm",
  "dĩ nhiên",
  "say rượu sau",
  "tự hài đồng lúc",
  "chuẩn bị chịu",
  "cùng hắn nói",
  "toàn bộ có hắn định",
  "cứ thế",
  "vẻ mặt tràn đầy nước mắt",
  "môn đã đóng",
  "dần dần từng bước",
  "đơn độc một bình",
  "hồ rượu thủy",
  "rét lạnh đêm",
  "mu muốn nhất khóc cảm động",
  "dơ bẩn thủ đoạn",
  "cái kia phút chốc",
  "đường hạ",
  "khắc đá pho tượng",
  "thất lạc lộn xộn",
  "nhà mình nhi",
  "phế vật này nhi",
  "đốn xanh mét",
  "ném qua nhân",
  "giết đi qua",
  "hỗn loạn đi ngủ",
  "mịt mờ thế giới",
  "nguyên nhân một người",
  "chú rể quần áo",
  "hạng gì thiên phú",
  "chạy ngoài",
  "đùa giỡn xoay quanh",
  "đính hôn ước hẹn",
  "sắt đá trên",
  "thưởng cùng",
  "dò mà đến",
  "sờ đến Triệu Vân thân thể",
  "lấy xuống cái cổ treo",
  "người đi đường",
  "chìm vào",
  "lực lượng",
  "lúc này mới",
  "thân mặc",
  "vung kiếm liền trảm",
  "bổ vào",
  "lau ra",
  "ngắt lấy",

  // Nhóm Thành Ngữ / Cụm Từ Cố Định (Idioms / Fixed Phrases)
  "thiên chi kiều nữ",
  "tự mình biết rõ",
  "không dám ngôn ngữ",
  "nhịn không được",
  "treo đầu dê bán thịt chó",
  "cẩn thiện từng li từng tí",
  "ngươi đẩy ta táng",
  "chàng chàng thiếp thiếp",
  "môn đăng hộ đối",
  "hòn ngọc quý trên tay",
  "con cóc ăn thịt thiên nga",
  "khinh người quá đáng",
  "tê tâm liệt phế",
  "mọi âm thanh đều yên tĩnh",
  "cái xác không hồn",
  "mơ mơ màng màng",
  "buồn bực sầu não mà chết",
  "chí tử",
  "không kiêng nể gì cả",
  "hồn nhiên thiên thành",
  "coi trời bằng vung",
  "cường giả vi tôn",
  "đáng đời",
  "khinh người quá mức",
  "đũa mốc mà đòi mâm son",
  "tập thể vò đầu",
  "chân chính coi trời bằng vung",
  "mất mặt",

  // Nhóm Mô Tả Nhân Vật / Bối Cảnh (Character / Scene Descriptions)
  "sát khí quấn thân",
  "mang mấy phần dữ tợn",
  "chất phác trống rỗng",
  "hơi lạnh cùng cao ngạo",
  "tê cả da đầu",
  "mặt sắc mặt xanh mét",
  "khói mù lung chiều",
  "lặng lẽ đứng lặng",
  "chảy tràn huyết",
  "hàn mang vội hiện",
  "triển lộ không bỏ sót",
  "bị cưỡng chế một đầu",
  "đối chọi gay gắt",
  "giương cung bạt kiếm",
  "yên ổn dọa người",
  "khóc không ra nước mắt",
  "ngây ngốc đứng lặng",
  "thân thể lạnh run",
  "bừng bừng tức giận",
  "tĩnh mịch",
  "co rúc ở chân tường",
  "lặng lẽ đáng sợ",
  "máu chảy ròng ròng",
  "đầm đìa nước mắt",
  "thút thít nỉ non",
  "nghẹn ngào",
  "lập loè vầng sáng",
  "tâm thần phiêu hốt",
  "chui tròng mắt",
  "mắt mù tân nương",
  "tịch đoạn mạch phế thể"
];

const results = [];

candidates.forEach(c => {
  const regex = new RegExp(c.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
  const matches = fullText.match(regex);
  const count = matches ? matches.length : 0;
  
  let sample = "";
  const lines = fullText.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes(c.toLowerCase())) {
      sample = line.trim();
      break;
    }
  }
  
  results.push({
    pattern: c,
    count: count,
    sample: sample
  });
});

results.sort((a, b) => b.count - a.count);

fs.writeFileSync('scratch/pattern_freq.json', JSON.stringify(results, null, 2), 'utf8');
console.log("Analysis written to pattern_freq.json");
