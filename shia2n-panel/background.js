// ツールバーのボタンでサイドパネルを開く設定だけ。画面は panel.html、各アプリの中身は各アプリの細い画面
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
