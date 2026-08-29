/** 隐藏页文案 — 林婷 · 了凡四训 · 茶 · 礼物 */

export type ChatLine = { from: "her" | "me"; text: string };

export type InterludeStep =
  | { kind: "divider"; label: string; sub?: string; fx: "noon" | "fade" | "dark" | "scent" | "tea" }
  | {
      kind: "narration";
      text: string;
      mood?: "typewriter" | "glow" | "cascade" | "breathe";
      fragments?: string[];
    }
  | { kind: "dialogue"; from: "her" | "me"; text: string };

export const secretRomance = {
  herName: "林婷",
  title: "青与银",
  subtitle: "给林婷 · 了凡四训线下课 · 一壶印象深刻的茶",
  dedication:
    "林婷，你看见我发呆，走过来问要不要沏茶。我们聊了很多。你把金刚经和两张纸条给我，我把跟了很久的绿檀手链送给你。这些，我都记着。",

  colors: {
    cyan: {
      name: "天真善良的青",
      hex: "#5eead4",
      desc: "林婷递茶时的眼神——清澈、柔软，像水面初起的涟漪。",
    },
    silver: {
      name: "坚韧的银",
      hex: "#c0d4e8",
      desc: "义工岗上忙进忙出的林婷——安静承担，亮而不刺。",
    },
  },

  /** 课前 · 对话（到去上课为止） */
  chatMorning: [
    { from: "her", text: "你在发什么呆呀？" },
    { from: "me", text: "啊……没有，就随便看看。" },
    { from: "her", text: "我给你沏壶茶吧？" },
    { from: "me", text: "好啊——诶，要上课了。" },
    { from: "her", text: "没事，先去上课吧。" },
  ] as ChatLine[],

  /** 去上课之后 · 分段过渡 */
  interludeSteps: [
    {
      kind: "divider",
      label: "中午",
      sub: "茶桌",
      fx: "noon",
    },
    {
      kind: "narration",
      mood: "typewriter",
      text: "下课铃响过，我独自走到茶桌。杯子里留着茶叶，我斟满，喝下了那一口。我以为——下午之后，就见不到林婷了。",
    },
    {
      kind: "divider",
      label: "我以为",
      sub: "见不到了",
      fx: "fade",
    },
    {
      kind: "narration",
      mood: "glow",
      text: "心里像关了一盏灯。也没敢问义工们会不会还在，更不敢问，她还会不会出现。",
    },
    {
      kind: "divider",
      label: "晚上",
      sub: "关灯的教室",
      fx: "dark",
    },
    {
      kind: "narration",
      mood: "glow",
      text: "晚上，教室的灯关了。义工们陆续走进来，脚步声、低语声，在暗处一格一格亮起。",
    },
    {
      kind: "divider",
      label: "气息",
      sub: "她来了",
      fx: "scent",
    },
    {
      kind: "narration",
      mood: "breathe",
      text: "我先感觉到的，是中午茶桌旁她身上那种气息——青色的气，还有淡淡的银色的气息。我看不见她，但我知道：林婷来了。",
    },
    {
      kind: "narration",
      mood: "cascade",
      text: "人群里我还找不到她的脸，灯也还没全亮。可那种熟悉感，不用看清，就知道是她。",
      fragments: [
        "人群里我还找不到她的脸，",
        "灯也还没全亮。",
        "可那种熟悉感，不用看清，就知道是她。",
      ],
    },
    {
      kind: "divider",
      label: "再度",
      sub: "一边喝茶",
      fx: "tea",
    },
    {
      kind: "narration",
      mood: "typewriter",
      text: "后来我们坐在一处，一边喝茶，一边聊了很多。像把中午没来得及说的话，都在晚上补上了。",
    },
    {
      kind: "dialogue",
      from: "me",
      text: "下午我还以为……见不到你了。",
    },
    {
      kind: "dialogue",
      from: "her",
      text: "怎么会呀。",
    },
  ] as InterludeStep[],

  /** 晚上 · 茶后继续聊 */
  chatEvening: [
    { from: "me", text: "今天聊得挺开心的。" },
    { from: "her", text: "我也是呀，你挺有意思的。" },
    { from: "me", text: "这条绿檀手链我戴了很久了，想送给你。" },
    { from: "her", text: "真的吗？那我也给你准备了东西……" },
    { from: "her", text: "一本金刚经，里面还有两张小纸条。" },
    { from: "me", text: "我会好好收着的。谢谢你，林婷。" },
  ] as ChatLine[],

  bracelet: {
    title: "绿檀手链",
    desc: "跟了我很多年的小物件。那天晚上递出去的时候，手心有点汗——不是舍不得，是怕唐突。但你收下了。",
  },

  sutra: {
    title: "金刚经",
    publisher: "弘化社编",
    desc: "你递过来的时候很轻，我却觉得沉——沉的是心意，不是重量。",
  },

  notes: [
    {
      id: "2-1",
      color: "yellow",
      label: "2-1",
      text: "王旭：\n你是一个拥有强大能量的人，像你的名字一样，旭日东升。现在的你，也许是夕阳的阳光，没那么强烈，却很舒宁。而当你我回归最初的本我",
    },
    {
      id: "2-2",
      color: "pink",
      label: "2-2",
      text: "你会像冉冉升起的太阳，照耀到每一寸每一个角落，滋养、温暖万物，给人能量。愿你我回归自己，照亮自己的本心，激发出你本有的能量和光芒。",
      smile: true,
    },
  ],

  poem: `// 写给林婷 — romance.ts
const 林婷 = { 青: true, 银: true, 笑: "很亮" };

async function 那天() {
  await 聊天("课前"); // 去上课
  await 独处("中午喝茶"); // 以为见不到了
  await 感知("气息"); // 关灯教室，先感觉她
  await 聊天("晚上"); // 一边喝茶一边聊

  await 我.give("绿檀手链");
  const 回礼 = await 林婷.give(["金刚经", "纸条×2"]);
  return 林婷;
}`,

  /** romance.ts 逐行执行 · 每步配故事画面 */
  codeStorySteps: [
    {
      id: "header",
      codeLine: "// 写给林婷 — romance.ts",
      title: "程序员的浪漫",
      caption: "把那天写进代码里——只有懂的人，才读得到。",
      scene: "header" as const,
      pauseMs: 2200,
    },
    {
      id: "intro",
      codeLine: 'const 林婷 = { 青: true, 银: true, 笑: "很亮" };',
      title: "林婷",
      caption: "她是天真善良的青，也是坚韧的银。她的笑，很亮。",
      scene: "intro" as const,
      pauseMs: 3200,
    },
    {
      id: "fn",
      codeLine: "async function 那天() {",
      title: "那天",
      caption: "了凡四训的一堂课，从一壶茶开始。",
      scene: "fn" as const,
      pauseMs: 2000,
    },
    {
      id: "chat-am",
      codeLine: '  await 聊天("课前");',
      comment: "去上课",
      title: "课前 · 和林婷",
      caption: "她看见我发呆，问要不要沏茶。我说要上课了——她说「没事，先去上课吧。」",
      scene: "chat-am" as const,
      pauseMs: 3800,
    },
    {
      id: "noon",
      codeLine: '  await 独处("中午喝茶");',
      comment: "以为见不到了",
      title: "中午 · 独自喝茶",
      caption: "我独自走到茶桌，喝下了那一口。忽然觉得——也许再也见不到林婷了。",
      scene: "noon" as const,
      pauseMs: 3800,
    },
    {
      id: "scent",
      codeLine: '  await 感知("气息");',
      comment: "关灯教室，先感觉她",
      title: "晚上 · 气息",
      caption: "教室关了灯。我看不见她，却先感觉中午那种熟悉的气息——我知道，林婷来了。",
      scene: "scent" as const,
      pauseMs: 4000,
    },
    {
      id: "chat-pm",
      codeLine: '  await 聊天("晚上");',
      comment: "一边喝茶一边聊",
      title: "晚上 · 再度喝茶",
      caption: "我们坐在一处，一边喝茶一边聊。像把白天没说完的话，都在夜里补上了。",
      scene: "chat-pm" as const,
      pauseMs: 3800,
    },
    {
      id: "bracelet",
      codeLine: '  await 我.give("绿檀手链");',
      title: "送出绿檀手链",
      caption: "跟了我很多年的手链递出去——不是舍不得，是怕唐突。但她收下了。",
      scene: "bracelet" as const,
      pauseMs: 3500,
    },
    {
      id: "gift",
      codeLine: '  const 回礼 = await 林婷.give(["金刚经", "纸条×2"]);',
      title: "林婷的回礼",
      caption: "一本金刚经，两张叠在书里的纸条——关于旭，关于太阳。",
      scene: "gift" as const,
      pauseMs: 3800,
    },
    {
      id: "return",
      codeLine: "  return 林婷;",
      title: "return 林婷",
      caption: "这一行，是我能写出的最浪漫的返回值。",
      scene: "return" as const,
      pauseMs: 3500,
    },
    {
      id: "close",
      codeLine: "}",
      title: "}",
      caption: "故事没有结束。茶还在，林婷也在。",
      scene: "close" as const,
      pauseMs: 2800,
    },
  ],

  timeline: [
    {
      id: "daze",
      time: "上午 · 课前",
      title: "发呆",
      body: "了凡四训的教室外阳光很好。我盯着某个地方出神，林婷大概是看见了，从那边走过来——轻轻的一句：要不要给你沏壶茶？",
      whisper: "那一眼，比阳光先照到我。",
    },
    {
      id: "class",
      time: "上午 · 课前",
      title: "去上课",
      body: "林婷说「没事，先去上课吧」。我跟着人群进教室，茶没来得及喝，话也没说完——心里却记住了她的声音。",
      whisper: "她的声音留在门口，我带进教室了。",
    },
    {
      id: "noon",
      time: "中午 · 饭后",
      title: "独自喝茶",
      body: "我独自走到茶桌，喝下了那一口。然后忽然觉得：也许再也见不到林婷了。",
      whisper: "我想念那杯茶。",
    },
    {
      id: "dark",
      time: "晚上 · 关灯",
      title: "教室",
      body: "晚上，关灯的教室。义工们陆续进来——我看不见她，却先感觉到中午那种熟悉的气息。我知道，林婷来了。",
      whisper: "暗处先亮起的，是她。",
    },
    {
      id: "night-tea",
      time: "晚上",
      title: "再度喝茶",
      body: "后来我们坐在一处，一边喝茶一边聊了很多。像把白天没说完的话，都在夜里补上了。",
      whisper: "原来没说完的话，晚上都会遇见。",
    },
    {
      id: "gift",
      time: "晚上 · 交换",
      title: "手链与经书",
      body: "我把跟了很久的绿檀木手链送给了林婷。她回赠一本金刚经，和两张叠在书里的纸条。",
      whisper: "手链离手，得到了更好的回礼。",
    },
    {
      id: "night",
      time: "晚上",
      title: "林婷在我眼里",
      body: "她是天真善良的青色，也是坚韧的银色。两种光叠在一起，像纸条上的字——关于旭，关于太阳。",
      whisper: "青与银，是我学会形容她的方式。",
    },
    {
      id: "code",
      time: "后来",
      title: "程序员的浪漫",
      body: "我把林婷、茶、手链、纸条，写进这个隐藏的页面。像 private repo——只有懂的人，才读得到。",
      whisper: "这一页，只写给林婷。",
    },
  ],

  sunQuote: "你会像冉冉升起的太阳——林婷写在纸条里的话，我想还给她：愿你也被光照亮。",

  footnote: "致林婷。此页无索引，像私有的 const，不 export 给世界。",
};

export type TeaStage = "idle" | "offer" | "bell" | "noon" | "drink" | "night";

export type UnlockStage =
  | "tea"
  | "chat"
  | "interlude"
  | "chatNight"
  | "gift"
  | "notes"
  | "colors"
  | "story"
  | "sun";

/** 时光机 · 主章节标签 */
export const stageTimeLabels: Record<
  UnlockStage,
  { label: string; icon: string; detail: string }
> = {
  tea: { label: "沏茶", icon: "🍵", detail: "林婷看见我发呆" },
  chat: { label: "课前对话", icon: "💬", detail: "要不要给你沏壶茶" },
  interlude: { label: "我以为见不到了", icon: "🌙", detail: "中午到晚上的空白" },
  chatNight: { label: "晚上喝茶", icon: "🍵", detail: "一边喝茶一边聊" },
  gift: { label: "交换礼物", icon: "📿", detail: "手链与金刚经" },
  notes: { label: "纸条", icon: "📝", detail: "2-1 与 2-2" },
  colors: { label: "青与银", icon: "🎨", detail: "林婷在我眼里" },
  story: { label: "romance.ts", icon: "⌨", detail: "代码讲述故事" },
  sun: { label: "升起旭阳", icon: "🌅", detail: "最后的光" },
};

export type TimeMachineStep = {
  id: string;
  stage: UnlockStage;
  label: string;
  detail?: string;
  icon?: string;
  at: number;
};

export function interludeStepLabel(
  step: InterludeStep,
): string {
  if (step.kind === "divider") {
    return step.sub ? `${step.label} · ${step.sub}` : step.label;
  }
  if (step.kind === "dialogue") {
    return step.from === "her" ? `林婷：${step.text.slice(0, 10)}…` : step.text.slice(0, 14) + "…";
  }
  return step.text.slice(0, 16) + "…";
}
