import { expect, test } from "@playwright/test";

const route = "/#/work/ownagent?tab=product&view=chat";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("customer home only promises the three released skills", async ({ page }) => {
  await page.goto(route);

  for (const label of ["费用与对账", "客服工单", "门店排班"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  for (const withdrawn of ["额度测算", "合同审查", "流程查询", "单据识读"]) {
    await expect(page.getByRole("button", { name: withdrawn, exact: true })).toHaveCount(0);
  }

  const body = page.locator("body");
  await expect(body).not.toContainText(/session[_-]?id|run[_-]?id|skill[_-]?id/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("shift desk completes a real import, rerun and archive journey", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The full business journey runs once; mobile has its own layout gate.");
  await page.goto(route);

  const prompt = page.getByRole("textbox", { name: /描述要办的事/ });
  await prompt.fill("请根据员工表和班次需求安排下周门店排班");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByText(/还需要您提供下面 2 份材料/).first()).toBeVisible();

  const files = page.locator('input[type="file"]');
  await expect(files).toHaveCount(2);
  await files.nth(0).setInputFiles({
    name: "十月员工表.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,请假日期\n" +
        "陈晨,收银|值班长,全职,40,1|2|3|4|5,08:00,20:00,31,\n" +
        "林琳,收银,全职,40,1|2|3|4|5,08:00,20:00,27,\n",
    ),
  });
  await files.nth(1).setInputFiles({
    name: "十月班次需求.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF日期,班次,开始,结束,岗位,人数\n" +
        "2026-10-19,早班,09:00,17:00,收银,1\n" +
        "2026-10-20,早班,09:00,17:00,收银,2\n",
    ),
  });

  await expect(page.locator("em").filter({ hasText: /已导入.*2 行/ })).toHaveCount(2);
  await page.getByRole("button", { name: "继续执行", exact: true }).click();
  await expect(page.getByText(/覆盖率 100\.0%/).first()).toBeVisible({ timeout: 30_000 });

  await expect(page.getByRole("heading", { name: "修正材料后重新办理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "人工复核" })).toBeVisible();

  const replaceStaff = page.getByRole("button", { name: "替换员工表", exact: true });
  await replaceStaff.setInputFiles({
    name: "十月员工表-修正版.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF员工,岗位技能,用工类型,周工时上限,可上班星期,最早,最晚,时薪,请假日期\n" +
        "陈晨,收银|值班长,全职,40,1|2|3|4|5,08:00,20:00,31,\n" +
        "林琳,收银,全职,40,1|2|3|4|5,08:00,20:00,27,\n" +
        "周周,收银,兼职,20,1|2|3|4|5,08:00,20:00,25,\n",
    ),
  });
  await expect(page.getByText("十月员工表-修正版", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "复核通过并办结归档", exact: true }).click();
  await expect(page.getByRole("button", { name: "已办结归档", exact: true })).toBeDisabled();
});

test("ticket desk imports both source systems, reruns and archives", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The full business journey runs once; mobile has its own layout gate.");
  await page.goto(route);
  await page.getByRole("textbox", { name: /描述要办的事/ }).fill("把这批客服工单分级并分派给在岗坐席");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByText(/还需要您提供下面 2 份材料/).first()).toBeVisible();

  const files = page.locator('input[type="file"]');
  await expect(files).toHaveCount(2);
  await files.nth(0).setInputFiles({
    name: "十月客服工单.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF工单号,客户,创建时间,首次响应时间,解决时间,标题,内容,状态\n" +
        "Q771,客户甲,2026-10-13 09:00,2026-10-13 09:20,,退款没到账,申请退款一周了还没到账,处理中\n" +
        "Q772,客户乙,2026-10-13 10:00,,,APP闪退,一打开就闪退,待处理\n" +
        "Q773,客户丙,2026-10-13 11:00,2026-10-13 11:05,2026-10-13 11:40,如何改密码,请问在哪里改密码,已解决\n",
    ),
  });
  await files.nth(1).setInputFiles({
    name: "十月客服坐席.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("\uFEFF坐席,技能组,在岗\n坐席甲,账务组|综合组,是\n坐席乙,技术组,是\n"),
  });
  await expect(page.getByText("十月客服工单", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("十月客服坐席", { exact: false })).toBeVisible({ timeout: 30_000 });
  const continueBtn = page.getByRole("button", { name: "继续执行", exact: true });
  await expect(continueBtn).toBeEnabled({ timeout: 30_000 });
  await continueBtn.click();
  await expect(page.getByText(/共 3 张工单/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "修正材料后重新办理" })).toBeVisible();

  await page.getByRole("button", { name: "替换坐席表", exact: true }).setInputFiles({
    name: "十月客服坐席-修正版.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("\uFEFF坐席,技能组,在岗\n坐席甲,账务组|综合组,是\n坐席乙,技术组,是\n坐席丙,综合组,是\n"),
  });
  await expect(page.getByText("十月客服坐席-修正版", { exact: false })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "复核通过并办结归档", exact: true }).click();
  await expect(page.getByRole("button", { name: "已办结归档", exact: true })).toBeDisabled();
});

test("reimbursement desk imports, delivers CSV and archives", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The full business journey runs once; mobile has its own layout gate.");
  await page.goto(route);
  await page.getByRole("textbox", { name: /描述要办的事/ }).fill("按部门汇总报销表，标出和发票对不上的");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByText(/还需要您提供下面这份材料/).first()).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "十月真实报销明细.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "\uFEFF部门,申请人,金额,税额,发票额,状态\n" +
        "华东运营,经办甲,77701,10101,77701,待审\n" +
        "华东运营,经办乙,88802,11544,88802,待审\n",
    ),
  });
  await expect(page.locator("em").filter({ hasText: /已导入/ })).toHaveCount(1);
  const continueBtn = page.getByRole("button", { name: "继续执行", exact: true });
  await expect(continueBtn).toBeEnabled({ timeout: 30_000 });
  await continueBtn.click();
  await expect(page.getByText(/166503/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "下载对账表 CSV", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载对账表 CSV", exact: true }).click();
  await download;
  await page.getByRole("button", { name: "确认无误，办结归档", exact: true }).click();
  await expect(page.getByText(/已办结。归档明细/)).toBeVisible();
});
