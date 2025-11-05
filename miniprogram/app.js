// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "cloud1-1g6316vt2769d82c",
      // 在开发者工具中是否强制使用云端贴图（默认 false：使用本地兜底以避免 403）
      forceCloudTextures: false
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      // 始终初始化云开发；env 为空时使用默认环境（第一个创建的环境）
      try {
        wx.cloud.init({
          env: this.globalData.env,
          traceUser: true,
        });
      } catch (e) {
        console.warn('[cloud init] skipped:', e);
      }
    }
  },
});
