const Document = require('./document');
const cache = require('./util/cache');
const tool = require('./util/tool');
const Window = require('./window');

Component({
  properties: {
    baseUrl: {
      type: String,
    },
    query: {
      type: Object,
      value: {},
    },
    wxComponent: {
      type: String,
      value: 'default',
    },
    persistCookie: {
      type: Boolean,
      value: true,
    },
    domSubTreeLevel: {
      type: Number,
      value: 10,
    },
    setDataMode: {
      type: String,
      value: '',
    },
  },
  data: {
    pageId: '',
    bodyClass: 'h5-body miniprogram-root',
    bodyStyle: '',
  },
  lifetimes: {
    attached() {
      this.handleLoad();
    },
    detached() {
      this.handleUnload();
    },
  },
  pageLifetimes: {
    show() {
      // 方便调试
      global.window = this.window;
      global.document = this.document;
      this.document.$$visibilityState = 'visible';
      this.document.$$trigger('visibilitychange');
    },
    hide() {
      global.window = null;
      global.document = null;
      this.document.$$visibilityState = 'hidden';
      this.document.$$trigger('visibilitychange');
    },
  },
  methods: {
    handleLoad() {
      const { query } = this.properties;
      const pageId = `p-${tool.getId()}`;
      cache[pageId] = this;

      const window = new Window(pageId);
      const nodeIdMap = {};
      const document = new Document(pageId, nodeIdMap);

      this.pageId = pageId;
      this.window = window;
      this.document = document;
      this.query = query;
      this.nodeIdMap = nodeIdMap;

      this.window.$$miniprogram.init();

      this.document.documentElement.addEventListener('$$childNodesUpdate', () => {
        const domNode = this.document.body;
        const data = {
          bodyClass: `${domNode.className || ''} h5-body miniprogram-root`, // 增加默认 class
          bodyStyle: domNode.style.cssText || '',
        };

        if (data.bodyClass !== this.data.bodyClass || data.bodyStyle !== this.data.bodyStyle) {
          this.setData(data);
        }
      });

      this.window.$$createSelectorQuery = () => wx.createSelectorQuery().in(this);
      this.window.$$createIntersectionObserver = options => wx.createIntersectionObserver(this, options);
      this.window.$$getOpenerEventChannel = () => this.getOpenerEventChannel();
      this.document.$$visibilityState = 'prerender';

      this.setData({ pageId: this.pageId }, () => {
        this.triggerEvent('ready', {
          window: this.window,
          document: this.document,
        });
        this.window.$$trigger('load');
      });
    },
    handleUnload() {
      this.document.$$visibilityState = 'unloaded';
      this.window.$$trigger('beforeunload');
      this.document.body.$$recycle(); // 回收 dom 节点
      this.window.$$destroy();

      delete cache[this.pageId];
      global.window = null;
      global.document = null;

      this.pageId = null;
      this.nodeIdMap = null;
      this.window.getTabBar = null;
      this.window = null;
      this.document = null;
      this.app = null;
      this.query = null;

      this.setData({
        pageId: '',
        bodyClass: 'h5-body miniprogram-root',
        bodyStyle: '',
      });
    },
    handleReload() {
      this.handleUnload();
      this.handleLoad();
    },
  },
});
