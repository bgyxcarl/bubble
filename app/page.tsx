import RootApp from '../components/RootApp'

export default function Page() {
  // const email = "user@example.com";
  // const probability4 = testGenerateUserIdDuplicateProbability(email, 8, 200000);
  // const probability5 = testGenerateUserIdDuplicateProbability(email, 9, 200000);
  // console.log(`重复概率1: ${probability4}`);
  // console.log(`重复概率2: ${probability5}`);


  // 用于存储重复概率的状态
  // const [probability4, setProbability4] = useState<number | null>(null);
  // const [probability5, setProbability5] = useState<number | null>(null);
  // useEffect(() => {
  //   const calculateProbabilities = async () => {
  //     const probability4Result = await testGenerateUserId2DuplicateProbability(email, 8, 100000);
  //     const probability5Result = await testGenerateUserId2DuplicateProbability(email, 9, 100000);

  //     setProbability4(probability4Result);  // 更新状态
  //     setProbability5(probability5Result);  // 更新状态

  //     console.log(`重复概率1: ${probability4Result}`);
  //     console.log(`重复概率2: ${probability5Result}`);
  //   };
  //   calculateProbabilities();  // 调用计算函数
  // }, [email]);

  return <RootApp />
}
