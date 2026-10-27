function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('platform-mac state-on')[0].innerText = "极简翻译已开启。可在 Safari 设置的“扩展”中管理网站权限或关闭它。";
        document.getElementsByClassName('platform-mac state-off')[0].innerText = "极简翻译尚未开启。请在 Safari 设置的“扩展”中勾选它，并允许它访问网站。";
        document.getElementsByClassName('platform-mac state-unknown')[0].innerText = "在 Safari 设置的“扩展”中打开“极简翻译”，并允许它访问网站。";
        document.getElementsByClassName('platform-mac open-preferences')[0].innerText = "退出并打开 Safari 设置…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
