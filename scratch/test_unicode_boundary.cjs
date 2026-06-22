const text1 = "Nàng, Liễu Như Nguyệt, Liễu gia đại tiểu thư, gia tộc hòn ngọc quý trên tay, Vong Cổ Thành thiên chi kiều nữ.";
const text2 = "Không người lại nhìn tốt bọn họ, liền chính hắn đều như vậy cho rằng...";

// Old regex using \b
const regexOld1 = /\bthiên chi kiều nữ\b/gi;
const regexOld2 = /\bnhìn tốt bọn họ\b/gi;

console.log("=== Testing ASCII \\b ===");
console.log("text1 matches \\b:", regexOld1.test(text1));
console.log("text2 matches \\b:", regexOld2.test(text2));

// New regex using Unicode lookarounds
const pattern1 = "(?<![a-zA-Zà-ỹÀ-Ỹ0-9_])thiên chi kiều nữ(?![a-zA-Zà-ỹÀ-Ỹ0-9_])";
const pattern2 = "(?<![a-zA-Zà-ỹÀ-Ỹ0-9_])nhìn tốt bọn họ(?![a-zA-Zà-ỹÀ-Ỹ0-9_])";

const regexNew1 = new RegExp(pattern1, 'gi');
const regexNew2 = new RegExp(pattern2, 'gi');

console.log("\n=== Testing Unicode Lookarounds ===");
console.log("text1 matches Unicode:", regexNew1.test(text1));
console.log("text2 matches Unicode:", regexNew2.test(text2));
console.log("Replacement test 1:", text1.replace(regexNew1, "con cưng của trời"));
console.log("Replacement test 2:", text2.replace(regexNew2, "xem trọng họ"));
