// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: ""
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      // 仅当配置了 env 时才初始化云开发，避免在本地/未配置环境下抛错
      if (this.globalData.env) {
        try {
          wx.cloud.init({
            env: this.globalData.env,
            traceUser: true,
          });
        } catch (e) {
          console.warn('[cloud init] skipped:', e);
        }
      } else {
        console.warn('[cloud init] env 未配置，跳过初始化以避免 Failed to fetch 报错');
      }
    }
  },
});
