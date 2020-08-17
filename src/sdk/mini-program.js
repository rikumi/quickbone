module.exports = class WebViewMiniProgram {
  constructor(window) {
    this.$_window = window;

    this.navigateTo = wx.navigateTo;
    this.navigateBack = wx.navigateBack;
    this.switchTab = wx.switchTab;
    this.redirectTo = wx.redirectTo;
    this.reLaunch = wx.reLaunch;

    this.postMessage = ({ data }) => {
      this.$_window.postMessage(data);
    };

    this.getEnv = cb => cb({ miniprogram: true });
  }
};
