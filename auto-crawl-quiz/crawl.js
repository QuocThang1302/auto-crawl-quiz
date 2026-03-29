const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Đang mở trang web...");
  await page.goto(
    "https://lms.uniapp.vn/elearning/student/test/128?m=549&c=82",
  );

  console.log("--------------------------------------------------");
  console.log("Vui lòng đăng nhập và đi đến màn hình CÂU HỎI SỐ 1.");
  console.log("Sau đó sang Playwright Inspector bấm nút 'Resume' (Play).");
  console.log("--------------------------------------------------");

  await page.pause();

  const results = [];
  let quizRound = 1;

  while (true) {
    try {
      console.log(`================ DE ${quizRound} ================`);

      let totalQuestions = null;

      // Thu lay tong so cau tu dang hien thi "Câu X/Y" hoac "Câu hỏi X/Y"
      const headerText = await page.innerText("body");
      const totalMatch =
        headerText.match(/Câu(?:\s+hỏi)?\s*\d+\s*\/\s*(\d+)/i) ||
        headerText.match(/S[ốo]\s*c[âa]u\s*h[ỏo]i\s*:?[\s\u00A0]*(\d+)/i);
      if (totalMatch) {
        totalQuestions = Number(totalMatch[1]);
        console.log(`Tong so cau tu dong nhan dien: ${totalQuestions}`);
      } else {
        console.log("Khong doc duoc tong so cau tu header, se tu dong lam den khi het nut tiep tuc.");
      }

      // Bắt đầu cào từ Câu 1, nếu không biết tổng thì chạy đến khi hết nút tiếp tục
      let i = 1;
      let answeredCount = 0;
      let canAutoSubmit = false;

      while (totalQuestions ? i <= totalQuestions : true) {
      console.log(`Đang xử lý câu ${i}...`);

      const questionPattern = new RegExp(
        `Câu(?:\\s+hỏi)?\\s*${i}(?:\\s*\\/\\s*\\d+)?`,
        "i",
      );
      const questionLabel = page.getByText(questionPattern).first();
      const questionVisible = await questionLabel
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => true)
        .catch(() => false);

      if (!questionVisible) {
        console.log(`⚠️ Không tìm thấy Câu ${i}, dừng để tránh chạy quá số câu thực tế.`);
        break;
      }

      // BƯỚC 1: Bắt các đáp án TRƯỚC (thêm .first() để bắt chính xác thằng đầu tiên thấy)
      const optionsTextArray = [];
      const opt1 = page.getByText(/^1\./).first();
      const opt2 = page.getByText(/^2\./).first();
      const opt3 = page.getByText(/^3\./).first();
      const opt4 = page.getByText(/^4\./).first();
    /*
        // Chờ đáp án 1 xuất hiện để chắc chắn nội dung câu hỏi cũng đã load xong
        await opt1.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });

        if (await opt1.isVisible()) optionsTextArray.push(await opt1.innerText());
        if (await opt2.isVisible()) optionsTextArray.push(await opt2.innerText());
        if (await opt3.isVisible()) optionsTextArray.push(await opt3.innerText());
        if (await opt4.isVisible()) optionsTextArray.push(await opt4.innerText());

        // BƯỚC 2: Lấy nội dung câu hỏi bằng kỹ thuật "Cắt bánh mì kẹp thịt"
        let questionText = "Chưa lấy được nội dung";

        if (optionsTextArray.length > 0) {
            // Lấy TẤT CẢ chữ đang hiển thị trên trình duyệt
            const bodyText = await page.innerText('body');

            const startMarker = `Câu ${i}`;
            const endMarker = optionsTextArray[0]; // Mốc kết thúc chính là nội dung đáp án 1 (VD: "1. Dừng lại...")

            // Tìm vị trí của "Câu i" và "Đáp án 1" trong đống text đó
            const startIdx = bodyText.indexOf(startMarker);
            const endIdx = bodyText.indexOf(endMarker, startIdx);

            if (startIdx !== -1 && endIdx !== -1) {
                // Cắt lấy phần ruột ở giữa và dùng trim() để dọn dẹp khoảng trắng thừa/dấu xuống dòng
                questionText = bodyText.substring(startIdx + startMarker.length, endIdx).trim();
            }
        }

        results.push({
            id: i,
            question: questionText,
            options: optionsTextArray,
            selectedAnswer: 1
        });

        // Ghi đè file JSON liên tục
        fs.writeFileSync('cau_hoi_phap_luat.json', JSON.stringify(results, null, 2), 'utf-8');
        */
      if (await opt1.isVisible()) {
        await opt1.click();
      }

      answeredCount += 1;

      const nextButton = page.getByText("Lưu câu trả lời và tiếp tục", {
        exact: false,
      });

      let hasNextButton = (await nextButton.count()) > 0;
      let nextButtonVisible = hasNextButton
        ? await nextButton.isVisible().catch(() => false)
        : false;
      let nextButtonEnabled = hasNextButton && nextButtonVisible
        ? await nextButton.isEnabled().catch(() => false)
        : false;

      if (!hasNextButton || !nextButtonVisible || !nextButtonEnabled) {
        // Tránh kết luận quá sớm ở lúc UI đang chuyển trạng thái giữa 2 câu.
        await page.waitForTimeout(1500);
        hasNextButton = (await nextButton.count()) > 0;
        nextButtonVisible = hasNextButton
          ? await nextButton.isVisible().catch(() => false)
          : false;
        nextButtonEnabled = hasNextButton && nextButtonVisible
          ? await nextButton.isEnabled().catch(() => false)
          : false;
      }

      if (!hasNextButton || !nextButtonVisible || !nextButtonEnabled) {
        const finishedAllKnownQuestions = totalQuestions
          ? answeredCount >= totalQuestions
          : false;

        if (finishedAllKnownQuestions) {
          console.log("Đã làm đủ tổng số câu, cho phép tự động nộp bài.");
          canAutoSubmit = true;
        } else {
          console.log("Nút chuyển câu chưa sẵn sàng nhưng chưa đủ số câu. Dừng an toàn, KHÔNG tự nộp.");
        }
        break;
      }

      await nextButton.click({ noWaitAfter: true });
      await page.waitForTimeout(500);

      const nextQuestionPattern = new RegExp(
        `Câu(?:\\s+hỏi)?\\s*${i + 1}(?:\\s*\\/\\s*\\d+)?`,
        "i",
      );
      const movedToNextQuestion = await page
        .getByText(nextQuestionPattern)
        .first()
        .waitFor({ state: "visible", timeout: 4000 })
        .then(() => true)
        .catch(() => false);

      if (!movedToNextQuestion) {
        const finishedAllKnownQuestions = totalQuestions
          ? answeredCount >= totalQuestions
          : false;

        if (finishedAllKnownQuestions) {
          console.log("Không còn sang được câu kế, coi như đã tới câu cuối.");
          canAutoSubmit = true;
        } else {
          console.log("Bấm tiếp tục nhưng chưa sang được câu mới. Dừng an toàn để bạn kiểm tra lại.");
        }
        break;
      }

      i += 1;

      if (totalQuestions && i > totalQuestions) {
        console.log("Đã đạt tổng số câu dự kiến, thoát vòng lặp.");
        canAutoSubmit = true;
        break;
      }
      }

      console.log(`Da xu ly tong cong ${answeredCount} cau.`);

      console.log("🎉 Đã cào xong! Dữ liệu an toàn tại cau_hoi_phap_luat.json");

      // Tìm và click button "Nộp bài"
      const submitButton = page.getByText("Nộp bài", { exact: true });
      const safeToAutoSubmit = totalQuestions ? answeredCount >= totalQuestions : canAutoSubmit;
      if (canAutoSubmit && safeToAutoSubmit && answeredCount > 0 && (await submitButton.isVisible())) {
        console.log("Đang bấm nộp bài...");
        await submitButton.click();
        await page.waitForTimeout(2000); // Chờ 2 giây để nộp bài hoàn tất
        console.log("✅ Đã nộp bài thành công!");

        // Sau khi nộp bài, thử bấm nút chuyển sang đề tiếp theo nếu có
        const continueButton = page
          .getByRole("button", {
            name: /^(tiếp tục|làm đề tiếp theo|đề tiếp theo|tiếp tục làm bài)$/i,
          })
          .first();

        const hasContinueButton = (await continueButton.count()) > 0;
        if (hasContinueButton) {
          const continueVisible = await continueButton.isVisible().catch(() => false);
          const continueEnabled = await continueButton.isEnabled().catch(() => false);
          if (continueVisible && continueEnabled) {
            console.log("Đang bấm nút tiếp tục để làm đề tiếp theo...");
            await continueButton.click();
            await page.waitForLoadState("domcontentloaded");
            console.log("✅ Đã chuyển sang màn hình đề tiếp theo, bắt đầu lại từ Câu 1.");
            console.log("Nếu trang cần thao tác thêm, hãy bấm Resume khi sẵn sàng.");
            await page.pause();
            quizRound += 1;
            continue;
          }
        }
      } else {
        console.log("⚠️ Chưa đủ điều kiện auto nộp bài (có thể bạn đang ở giữa đề hoặc chưa làm câu nào).");
      }

      break;
    } catch (err) {
      console.log(`❌ Gặp lỗi ở đề ${quizRound}: ${err.message}`);
      console.log("Hãy quay lại đề, vào Câu 1 rồi bấm Resume để chạy lại đề hiện tại.");
      await page.pause();
      continue;
    }
  }

  console.log("Trình duyệt sẽ tiếp tục mở. Đóng nó bằng tay khi cần.");
})();
