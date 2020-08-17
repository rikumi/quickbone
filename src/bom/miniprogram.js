const cache = require('../util/cache');

class Miniprogram {
  constructor(pageId) {
    this.$_pageId = pageId;
    this.$_pageUrl = ''; // 页面真实 url
  }

  get window() {
    return cache[this.$_pageId].window || null;
  }

  get document() {
    return cache[this.$_pageId].document || null;
  }

  get config() {
    return cache[this.$_pageId].properties;
  }

  /**
     * 初始化
     */
  init() {
    const { baseUrl, query } = cache[this.$_pageId].properties;

    this.$_pageUrl = `${baseUrl}?${Object.keys(query)
      .map(k => `${k}=${query[k]}`)
      .join('&')}`;

    console.log('miniProgram init', cache[this.$_pageId].properties);
    this.window.location.$$reset(this.$_pageUrl);
    this.window.history.$$reset();
  }
}

module.exports = Miniprogram;
