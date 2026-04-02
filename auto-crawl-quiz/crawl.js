const { chromium } = require("playwright");

function normalizeText(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function getNormalizedBodyText(page) {
  const bodyText = await page.locator("body").innerText();
  return normalizeText(bodyText);
}

async function waitForQuestion(page, questionNumber, timeout = 5000) {
  const pattern = new RegExp(
    `\\bcau(?: hoi)?\\s*${questionNumber}(?:\\s*/\\s*\\d+)?\\b`,
    "i",
  );

  return await page
    .waitForFunction(
      ({ source }) => {
        const text = (document.body?.innerText || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\u0111/g, "d")
          .replace(/\u0110/g, "D")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        return new RegExp(source, "i").test(text);
      },
      { source: pattern.source },
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

async function detectTotalQuestions(page) {
  const normalizedText = await getNormalizedBodyText(page);
  const totalMatch =
    normalizedText.match(/cau(?: hoi)?\s*\d+\s*\/\s*(\d+)/i) ||
    normalizedText.match(/so\s*cau\s*hoi\s*:?\s*(\d+)/i);

  return totalMatch ? Number(totalMatch[1]) : null;
}

async function isVisible(locator) {
  return await locator.isVisible().catch(() => false);
}

async function isEnabled(locator) {
  return await locator.isEnabled().catch(() => false);
}

async function clickFirstAnswer(page) {
  const firstOption = page.getByText(/^1\./).first();
  await firstOption.waitFor({ state: "visible", timeout: 3000 });
  await firstOption.click({ timeout: 3000 });
}

async function clickControlByNormalizedText(page, phrases, options = {}) {
  const controls = page.locator(
    'button, a, [role="button"], input[type="button"], input[type="submit"]',
  );
  const count = await controls.count();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const visible = await isVisible(control);
    const enabled = await isEnabled(control);

    if (!visible || !enabled) {
      continue;
    }

    const rawText = await control.innerText().catch(() => "");
    const valueText = !rawText
      ? await control.getAttribute("value").catch(() => "")
      : "";
    const labelText = [rawText, valueText].filter(Boolean).join(" ");
    const normalizedLabel = normalizeText(labelText);

    if (phrases.some((phrase) => normalizedLabel.includes(phrase))) {
      await control.click(options);
      return true;
    }
  }

  return false;
}

async function hasControlByNormalizedText(page, phrases) {
  const controls = page.locator(
    'button, a, [role="button"], input[type="button"], input[type="submit"]',
  );
  const count = await controls.count();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const visible = await isVisible(control);
    const enabled = await isEnabled(control);

    if (!visible || !enabled) {
      continue;
    }

    const rawText = await control.innerText().catch(() => "");
    const valueText = !rawText
      ? await control.getAttribute("value").catch(() => "")
      : "";
    const labelText = [rawText, valueText].filter(Boolean).join(" ");
    const normalizedLabel = normalizeText(labelText);

    if (phrases.some((phrase) => normalizedLabel.includes(phrase))) {
      return true;
    }
  }

  return false;
}

async function clickNextAndWait(page, nextQuestionNumber) {
  const clicked = await clickControlByNormalizedText(
    page,
    ["luu cau tra loi va tiep tuc", "luu va tiep tuc", "tiep tuc"],
    { noWaitAfter: true, timeout: 3000 },
  );

  if (!clicked) {
    return false;
  }

  if (await waitForQuestion(page, nextQuestionNumber, 2500)) {
    return true;
  }

  return await waitForQuestion(page, nextQuestionNumber, 1500);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Dang mo trang web...");
  await page.goto(
    "https://lms.uniapp.vn/elearning/student/test/128?m=549&c=82",
  );

  console.log("--------------------------------------------------");
  console.log("Dang nhap va di den man hinh cau hoi so 1.");
  console.log("Sau do sang Playwright Inspector bam nut Resume.");
  console.log("--------------------------------------------------");

  await page.pause();

  let quizRound = 1;

  while (true) {
    try {
      console.log(`================ DE ${quizRound} ================`);

      await waitForQuestion(page, 1, 10000);

      const totalQuestions = await detectTotalQuestions(page);
      if (totalQuestions) {
        console.log(`Tong so cau tu dong nhan dien: ${totalQuestions}`);
      } else {
        console.log(
          "Khong doc duoc tong so cau, se lam den khi khong con nut tiep tuc.",
        );
      }

      let questionNumber = 1;
      let answeredCount = 0;
      let canAutoSubmit = false;

      while (totalQuestions ? questionNumber <= totalQuestions : true) {
        console.log(`Dang xu ly cau ${questionNumber}...`);

        const questionVisible = await waitForQuestion(
          page,
          questionNumber,
          5000,
        );
        if (!questionVisible) {
          console.log(
            `Khong tim thay cau ${questionNumber}, dung lai de tranh chay qua so cau thuc te.`,
          );
          break;
        }

        await clickFirstAnswer(page);
        answeredCount += 1;

        const movedToNextQuestion = await clickNextAndWait(
          page,
          questionNumber + 1,
        );
        if (!movedToNextQuestion) {
          const finishedAllKnownQuestions = totalQuestions
            ? answeredCount >= totalQuestions
            : false;

          if (finishedAllKnownQuestions) {
            console.log("Da lam du tong so cau, cho phep tu dong nop bai.");
            canAutoSubmit = true;
          } else if (
            !(await hasControlByNormalizedText(page, [
              "luu cau tra loi va tiep tuc",
              "luu va tiep tuc",
              "tiep tuc",
            ]))
          ) {
            console.log(
              "Nut chuyen cau chua san sang nhung chua du so cau. Dung an toan, khong tu nop.",
            );
          } else {
            console.log(
              "Bam tiep tuc nhung chua sang duoc cau moi. Dung an toan de kiem tra lai.",
            );
          }
          break;
        }

        questionNumber += 1;

        if (totalQuestions && questionNumber > totalQuestions) {
          console.log("Da dat tong so cau du kien, thoat vong lap.");
          canAutoSubmit = true;
          break;
        }
      }

      console.log(`Da xu ly tong cong ${answeredCount} cau.`);

      const safeToAutoSubmit = totalQuestions
        ? answeredCount >= totalQuestions
        : canAutoSubmit;

      if (
        canAutoSubmit &&
        safeToAutoSubmit &&
        answeredCount > 0 &&
        (await hasControlByNormalizedText(page, ["nop bai"]))
      ) {
        console.log("Dang bam nop bai...");
        await clickControlByNormalizedText(page, ["nop bai"], {
          timeout: 3000,
        });
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        console.log("Da nop bai thanh cong.");

        const hasContinueButton = await hasControlByNormalizedText(page, [
          "tiep tuc",
          "lam de tiep theo",
          "de tiep theo",
          "tiep tuc lam bai",
        ]);

        if (hasContinueButton) {
          console.log("Dang bam nut tiep tuc de lam de tiep theo...");
          await clickControlByNormalizedText(
            page,
            [
              "lam de tiep theo",
              "de tiep theo",
              "tiep tuc lam bai",
              "tiep tuc",
            ],
            { timeout: 3000 },
          );
          await page.waitForLoadState("domcontentloaded");
          console.log(
            "Da chuyen sang man hinh de tiep theo, bat dau lai tu cau 1.",
          );
          console.log(
            "Neu trang can thao tac them, hay bam Resume khi san sang.",
          );
          await page.pause();
          quizRound += 1;
          continue;
        }
      } else {
        console.log("Chua du dieu kien auto nop bai.");
      }

      break;
    } catch (error) {
      console.log(`Gap loi o de ${quizRound}: ${error.message}`);
      console.log(
        "Hay quay lai de, vao cau 1 roi bam Resume de chay lai de hien tai.",
      );
      await page.pause();
    }
  }

  console.log("Trinh duyet se tiep tuc mo. Dong no bang tay khi can.");
})();
