// ==UserScript==
// @name         ワンダーGYM 出欠入力日時チェック
// @namespace    https://github.com/a3design-aminagata/
// @version      1.1
// @description  ワンダーGYMの出欠入力ページで、今日以外の日付や開始時間前のレッスンを更新しようとすると警告を表示します。
// @author       Ami Nagata
// @match        https://wonder-gym.jp/lecturer-portal/online-lesson-attendances/online_lessons/*/edit
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	// ページの読み込みが完了してから実行
	window.addEventListener(
		"load",
		function () {
			// 1. 必要な情報をページから取得する
			//-----------------------------------------------------
			// 「参加受講生を更新する」ボタン
			const submitButton = document.querySelector(
				'input[type="submit"][value="参加受講生を更新する"]',
			);
			// 「開始日時」が書かれている要素
			const dateTimeElement = document.querySelector(
				".w-100.m-4.text-sm p.mx-4",
			);

			// 要素が見つからない場合は、処理を中断
			if (!submitButton || !dateTimeElement) {
				console.log(
					"必要な要素が見つからなかったため、スクリプトを停止します。",
				);
				return;
			}

			const dateTimeString = dateTimeElement.textContent.trim(); // "2026年03月19日(木) 15:00 ~ 16:00"

			// 2. 日時文字列を解析してJavaScriptのDateオブジェクトに変換
			//-----------------------------------------------------
			const regex = /(\d{4})年(\d{2})月(\d{2})日.*?(\d{2}):(\d{2})/;
			const match = dateTimeString.match(regex);

			if (!match) {
				console.log("日時の解析に失敗したため、スクリプトを停止します。");
				return;
			}

			const year = parseInt(match[1], 10);
			const month = parseInt(match[2], 10) - 1; // 月は0から始まるため-1する
			const day = parseInt(match[3], 10);
			const hour = parseInt(match[4], 10);
			const minute = parseInt(match[5], 10);

			const lessonDateTime = new Date(year, month, day, hour, minute);

			// 3. 更新ボタンがクリックされたときの処理を追加
			//-----------------------------------------------------
			submitButton.addEventListener("click", function (event) {
				const now = new Date();

				// 日付だけを比較するために、時間をリセットしたDateオブジェクトを作成
				const lessonDateOnly = new Date(lessonDateTime);
				lessonDateOnly.setHours(0, 0, 0, 0);
				const todayDateOnly = new Date(now);
				todayDateOnly.setHours(0, 0, 0, 0);

				const isLessonToday =
					lessonDateOnly.getTime() === todayDateOnly.getTime();
				const isBeforeStartTime = now < lessonDateTime;

				// ★警告を出す条件：
				// 1. レッスンが今日ではない
				//    または
				// 2. レッスンは今日だが、まだ開始時間になっていない
				if (!isLessonToday || isBeforeStartTime) {
					let warningMessage = "";

					if (!isLessonToday) {
						warningMessage =
							"このレッスンは【今日ではありません】！\n\n" +
							`レッスン日: ${lessonDateTime.toLocaleDateString()}\n\n` +
							"本当にこのまま更新しますか？";
					} else {
						// isLessonToday && isBeforeStartTime
						warningMessage =
							"このレッスンは【まだ開始されていません】！\n\n" +
							`開始時間: ${lessonDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}\n\n` +
							"本当にこのまま更新しますか？";
					}

					// 確認ダイアログを表示し、「キャンセル」が押されたら送信を中止
					if (!confirm(warningMessage)) {
						event.preventDefault(); // フォームの送信を中止
						console.log("更新をキャンセルしました。");
					}
				}
			});
		},
		false,
	);
})();
