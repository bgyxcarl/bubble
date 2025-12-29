import crypto from 'crypto';

export function generateUserId(
  email: string, 
  length: number=10, 
  numericOnly: boolean = false, 
): string {
  const salt = Date.now().toString() + Math.random().toString();
  // const salt = Date.now().toString() + randomBytes(4).toString();
  const hash = crypto.createHash('sha256').update(email + salt).digest('hex');
  // let uid = bigIntHash.toString();
  let uid: string;

  if (numericOnly) {
    // uid = BigInt('0x' + hash).toString();
    uid = BigInt('0x' + hash.substring(1, 25)).toString();
  } else {
    uid = hash;
  }

  // 截取逻辑优化: 从第 2 位开始截取，分布最均匀
  if (uid.length > length) {
    const start = Math.min(2, uid.length - length);
    uid = uid.substring(start, start + length);
  } else {
    uid = uid.padStart(length, numericOnly ? '0' : 'a');
  }

  // console.log('uid', uid)
  return uid;
}

// export async function generateUserId2(
//   email: string, 
//   length: number = 10, 
//   numericOnly: boolean = false
// ): Promise<string> {
//   const salt = Date.now().toString() + Math.random().toString();
//   const hash = createHash("sha256")
//     .update(email + salt)
//     .digest("hex");

//   let uid: string;

//   if (numericOnly) {
//     uid = BigInt("0x" + hash.substring(0, 15)).toString();
//   } else {
//     uid = hash;
//   }

//   // 截取逻辑优化: 从第 2 位开始截取，分布最均匀
//   if (uid.length > length) {
//     const start = Math.min(2, uid.length - length);
//     uid = uid.substring(start, start + length);
//   } else {
//     uid = uid.padStart(length, numericOnly ? "0" : "a");
//   }

//   return uid;
// }

// 测试重复概率的函数
// export function testGenerateUserIdDuplicateProbability(email: string, length: number, attempts: number = 100000): number {
//   console.time("testGenerateUserIdDuplicateProbability");  // 开始计时
//   const generatedIds = new Set<string>();
//   let duplicates = 0;

//   for (let i = 0; i < attempts; i++) {
//     const uid = generateUserId(email, length, true);
//     if (generatedIds.has(uid)) {
//       duplicates++;
//     } else {
//       generatedIds.add(uid);
//     }
//   }

//   const duplicateProbability = duplicates / attempts;
//   console.timeEnd("testGenerateUserIdDuplicateProbability");  // 结束计时并输出结果
//   return duplicateProbability;
// }

// export async function testGenerateUserId2DuplicateProbability(
//   email: string, 
//   length: number, 
//   attempts: number = 100000
// ): Promise<number> {
//   console.time("testGenerateUserId2DuplicateProbability");  // 开始计时

//   const generatedIds = new Set<string>();
//   let duplicates = 0;

//   for (let i = 0; i < attempts; i++) {
//     const uid = await generateUserId2(email, length, true);  // 使用4位随机数和数字 ID
//     if (generatedIds.has(uid)) {
//       duplicates++;
//     } else {
//       generatedIds.add(uid);
//     }
//   }

//   const duplicateProbability = duplicates / attempts;

//   console.timeEnd("testGenerateUserId2DuplicateProbability");  // 结束计时并输出结果

//   return duplicateProbability;
// }

// 测试 4 位和 5 位重复概率
// const email = "user@example.com";

// const probability4 = testGenerateUserIdDuplicateProbability(email, 4, 100000);  // 测试4位
// const probability5 = testGenerateUserIdDuplicateProbability(email, 5, 100000);  // 测试5位

// console.log(`重复概率 (4位): ${probability4}`);
// console.log(`重复概率 (5位): ${probability5}`);

