import type { ReportArticle, ReportImage, ReportTheme } from "@/types/report";

const imagePool = [
  "/images/1.webp",
  "/images/2.webp",
  "/images/3.webp",
  "/images/4.webp",
  "/images/5.webp",
  "/images/6.webp",
  "/images/7.webp",
  "/images/1.png",
];

const textSeeds = [
  "秋天，是丰收的季节。孩子们在活动区里观察水果、树叶和自然材料，通过采摘、分类、装盘和分享游戏，认识季节变化，也感受同伴合作带来的快乐。",
  "在探索过程中，宝贝们会主动表达自己的发现：叶子的颜色不一样，果实的味道不一样，风吹过树梢时声音也不一样。这些细小的观察，都是他们理解自然的开始。",
  "老师鼓励孩子们用眼睛看、用小手摸、用语言说，把日常生活中的经验变成一次完整的学习旅程。每一次尝试和交流，都让活动变得更加生动。",
  "爸爸妈妈也参与到活动中，陪孩子一起寻找秋天、记录秋天，把亲子陪伴留在照片和文字里。温暖的互动，让成长故事更有意义。",
];

function repeatText(seedIndex: number, repeat: number) {
  return Array.from(
    { length: repeat },
    (_, index) =>
      textSeeds[(seedIndex + index) % textSeeds.length] ?? textSeeds[0] ?? "",
  ).join("");
}

function buildImages(count: number, articleIndex: number): ReportImage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mock_${articleIndex + 1}_${index + 1}`,
    url:
      imagePool[(articleIndex + index) % imagePool.length] ??
      imagePool[0] ??
      "",
  }));
}

function cloneArticle(
  base: ReportArticle,
  articleIndex: number,
): ReportArticle {
  const imageCountPattern = [1, 2, 3, 4, 5, 7, 9, 12];
  const textRepeatPattern = [1, 2, 3, 5, 7];
  const imageCount =
    imageCountPattern[articleIndex % imageCountPattern.length] ?? 4;
  const textRepeat =
    textRepeatPattern[articleIndex % textRepeatPattern.length] ?? 2;

  return {
    content: {
      date: `2025/11/${String(8 + articleIndex).padStart(2, "0")}`,
      title: `${base.content.title} ${articleIndex + 1}`,
      text: repeatText(articleIndex, textRepeat),
    },
    gallery: buildImages(imageCount, articleIndex),
  };
}

export function createMockReportData(
  source: ReportTheme[],
  totalArticles = 20,
  themeCount = 3,
): ReportTheme[] {
  const fallbackTheme = source[0];
  if (!fallbackTheme) return [];

  const safeThemeCount = Math.max(1, themeCount);
  const safeTotalArticles = Math.max(1, totalArticles);

  return Array.from({ length: safeThemeCount }, (_, themeIndex) => {
    const baseTheme = source[themeIndex % source.length] ?? fallbackTheme;
    const basePages =
      baseTheme.pages.length > 0 ? baseTheme.pages : fallbackTheme.pages;
    const fallbackArticle = basePages[0];
    const articlesInTheme =
      Math.floor(safeTotalArticles / safeThemeCount) +
      (themeIndex < safeTotalArticles % safeThemeCount ? 1 : 0);

    if (!fallbackArticle) {
      return {
        theme: `${baseTheme.theme}-mock-${themeIndex + 1}`,
        background: baseTheme.background,
        header: baseTheme.header,
        pages: [],
      };
    }

    return {
      theme: `${baseTheme.theme}-mock-${themeIndex + 1}`,
      background: baseTheme.background,
      header: {
        title: `${baseTheme.header.title} · 动态主题 ${themeIndex + 1}`,
        description: `${baseTheme.header.description}${textSeeds[themeIndex % textSeeds.length] ?? textSeeds[0] ?? ""}`,
      },
      pages: Array.from({ length: articlesInTheme }, (_, articleIndex) =>
        cloneArticle(
          basePages[articleIndex % basePages.length] ?? fallbackArticle,
          themeIndex * safeTotalArticles + articleIndex,
        ),
      ),
    };
  });
}
