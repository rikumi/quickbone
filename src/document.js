const Cookie = require('./bom/cookie');
const EventTarget = require('./event/event-target');
const Comment = require('./node/comment');
const Element = require('./node/element');
const A = require('./node/element/a');
const Canvas = require('./node/element/canvas');
const Image = require('./node/element/image');
const Input = require('./node/element/input');
const NotSupport = require('./node/element/not-support');
const Option = require('./node/element/option');
const Select = require('./node/element/select');
const Textarea = require('./node/element/textarea');
const Video = require('./node/element/video');
const WxComponent = require('./node/element/wx-component');
const WxCustomComponent = require('./node/element/wx-custom-component');
const Node = require('./node/node');
const TextNode = require('./node/text-node');
const Tree = require('./tree/tree');
const cache = require('./util/cache');
const tool = require('./util/tool');

const CONSTRUCTOR_MAP = {
  A,
  IMG: Image,
  INPUT: Input,
  TEXTAREA: Textarea,
  VIDEO: Video,
  CANVAS: Canvas,
  SELECT: Select,
  OPTION: Option,
  'WX-COMPONENT': WxComponent,
};
const WX_COMPONENT_MAP = {};
const WX_COMPONENT_LIST = [
  'cover-image', 'cover-view', 'match-media', 'movable-area', 'movable-view', 'scroll-view', 'swiper', 'swiper-item', 'view',
  'icon', 'progress', 'rich-text', 'text',
  'button', 'checkbox', 'checkbox-group', 'editor', 'form', 'input', 'label', 'picker', 'picker-view', 'picker-view-column', 'radio', 'radio-group', 'slider', 'switch', 'textarea',
  'functional-page-navigator', 'navigator',
  'audio', 'camera', 'image', 'live-player', 'live-pusher', 'video', 'voip-room',
  'map',
  'canvas',
  'ad', 'official-account', 'open-data', 'web-view',
  // 特殊补充
  'capture', 'catch', 'animation',
];
WX_COMPONENT_LIST.forEach(name => WX_COMPONENT_MAP[name] = name);
let WX_CUSTOM_COMPONENT_MAP = {};

/**
 * 判断是否是内置组件
 */
function checkIsWxComponent(tagName, notNeedPrefix) {
  const hasPrefix = tagName.indexOf('wx-') === 0;
  if (notNeedPrefix) {
    return hasPrefix ? WX_COMPONENT_MAP[tagName.slice(3)] : WX_COMPONENT_MAP[tagName];
  }
  return hasPrefix ? WX_COMPONENT_MAP[tagName.slice(3)] : false;
}

class Document extends EventTarget {
  constructor(pageId, nodeIdMap) {
    super();

    const config = cache[pageId].properties;
    const { persistCookie } = config;
    WX_CUSTOM_COMPONENT_MAP = config.usingComponents || {};

    this.$_pageId = pageId;

    // 用于封装特殊标签和对应构造器
    const that = this;
    this.$_imageConstructor = function HTMLImageElement(width, height) {
      return Image.$$create({
        tagName: 'img',
        nodeId: `b-${tool.getId()}`, // 运行时生成，使用 b- 前缀
        attrs: {},
        width,
        height,
      }, that.$_tree);
    };

    this.$_pageId = pageId;
    this.$_tree = new Tree(pageId, {
      type: 'element',
      tagName: 'body',
      attrs: {},
      unary: false,
      nodeId: 'e-body',
      children: [],
    }, nodeIdMap, this);
    this.$_cookie = new Cookie(persistCookie);
    this.$_config = null;

    // documentElement
    this.$_node = this.$$createElement({
      tagName: 'html',
      attrs: {},
      nodeId: `a-${tool.getId()}`, // 运行前生成，使用 a- 前缀
      type: Node.DOCUMENT_NODE,
    });
    this.$_node.$$updateParent(this); // documentElement 的 parentNode 是 document

    // head 元素
    this.$_head = this.createElement('head');

    // 更新 body 的 parentNode
    this.$_tree.root.$$updateParent(this.$_node);
    this.$_node.$$children.push(this.$_tree.root);

    // 持久化 cookie
    if (persistCookie) {
      try {
        const cookie = wx.getStorageSync('PAGE_COOKIE');
        if (cookie) this.$$cookieInstance.deserialize(cookie);
      } catch (err) {
        // ignore
      }
    }
  }

  /**
     * Image 构造器
     */
  get $$imageConstructor() {
    return this.$_imageConstructor;
  }

  get $$pageId() {
    return this.$_pageId;
  }

  /**
     * 完整的 cookie，包括 httpOnly 也能获取到
     */
  get $$cookie() {
    return this.$_cookie.getCookie(this.URL, true);
  }

  /**
     * 获取 cookie 实例
     */
  get $$cookieInstance() {
    return this.$_cookie;
  }

  /**
     * 创建内置组件的时候是否支持不用前缀写法
     */
  get $$notNeedPrefix() {
    if (!this.$_config) this.$_config = cache[this.$_pageId].properties;
    return this.$_config && this.$_config && this.$_config.wxComponent === 'noprefix';
  }

  /**
     * 设置页面显示状态
     */
  set $$visibilityState(value) {
    this.$_visibilityState = value;
  }

  /**
     * 触发节点事件
     */
  $$trigger(eventName, options) {
    this.documentElement.$$trigger(eventName, options);
  }

  /**
     * 内部所有节点创建都走此接口，统一把控
     */
  $$createElement(options, tree) {
    const originTagName = options.tagName;
    const tagName = originTagName.toUpperCase();
    let wxComponentName = null;
    tree = tree || this.$_tree;

    const constructorClass = CONSTRUCTOR_MAP[tagName];
    if (constructorClass) {
      return constructorClass.$$create(options, tree);
      // eslint-disable-next-line no-cond-assign
    } if (wxComponentName = checkIsWxComponent(originTagName, this.$$notNeedPrefix)) {
      // 内置组件的特殊写法，转成 wx-component 节点
      options.tagName = 'wx-component';
      options.attrs = options.attrs || {};
      options.attrs.behavior = wxComponentName;
      return WxComponent.$$create(options, tree);
    } if (WX_CUSTOM_COMPONENT_MAP[originTagName]) {
      // 自定义组件的特殊写法，转成 wx-custom-component 节点
      options.tagName = 'wx-custom-component';
      options.attrs = options.attrs || {};
      options.componentName = originTagName;
      return WxCustomComponent.$$create(options, tree);
    } if (!tool.isTagNameSupport(tagName)) {
      return NotSupport.$$create(options, tree);
    }
    return Element.$$create(options, tree);
  }

  /**
     * 内部所有文本节点创建都走此接口，统一把控
     */
  $$createTextNode(options, tree) {
    return TextNode.$$create(options, tree || this.$_tree);
  }

  /**
     * 内部所有注释节点创建都走此接口，统一把控
     */
  $$createComment(options, tree) {
    return Comment.$$create(options, tree || this.$_tree);
  }

  /**
     * 处理 Set-Cookie 头串
     */
  $$setCookie(str) {
    if (str && typeof str === 'string') {
      let start = 0;
      let startSplit = 0;
      let nextSplit = str.indexOf(',', startSplit);
      const cookies = [];

      while (nextSplit >= 0) {
        const lastSplitStr = str.substring(start, nextSplit);
        const splitStr = str.substr(nextSplit);

        if (/^,\s*([^,=;\x00-\x1F]+)=([^;\n\r\0\x00-\x1F]*).*/.test(splitStr)) {
          // 分割成功，则上一片是完整 cookie
          cookies.push(lastSplitStr);
          start = nextSplit + 1;
        }

        startSplit = nextSplit + 1;
        nextSplit = str.indexOf(',', startSplit);
      }

      // 塞入最后一片 cookie
      cookies.push(str.substr(start));

      cookies.forEach(cookie => this.cookie = cookie);
    }
  }

  /**
     * 对外属性和方法
     */
  get nodeType() {
    return Node.DOCUMENT_NODE;
  }

  get documentElement() {
    return this.$_node;
  }

  get body() {
    return this.$_tree.root;
  }

  get nodeName() {
    return '#document';
  }

  get head() {
    return this.$_head;
  }

  get defaultView() {
    return cache[this.$_pageId].window || null;
  }

  get URL() {
    if (this.defaultView) return this.defaultView.location.href;

    return '';
  }

  get cookie() {
    return this.$_cookie.getCookie(this.URL);
  }

  set cookie(value) {
    if (!value || typeof value !== 'string') return;

    this.$_cookie.setCookie(value, this.URL);
  }

  get visibilityState() {
    return this.$_visibilityState;
  }

  get hidden() {
    return this.$_visibilityState === 'visible';
  }

  getElementById(id) {
    if (typeof id !== 'string') return;

    return this.$_tree.getById(id) || null;
  }

  getElementsByTagName(tagName) {
    if (typeof tagName !== 'string') return [];

    return this.$_tree.getByTagName(tagName, this.documentElement);
  }

  getElementsByClassName(className) {
    if (typeof className !== 'string') return [];

    return this.$_tree.getByClassName(className, this.documentElement);
  }

  getElementsByName(name) {
    if (typeof name !== 'string') return [];

    return this.$_tree.query(`*[name=${name}]`, this.documentElement);
  }

  querySelector(selector) {
    if (typeof selector !== 'string') return null;

    return this.$_tree.query(selector, this.documentElement)[0] || null;
  }

  querySelectorAll(selector) {
    if (typeof selector !== 'string') return [];

    return this.$_tree.query(selector, this.documentElement);
  }

  createElement(tagName) {
    if (typeof tagName !== 'string') return;

    tagName = tagName.trim();
    if (!tagName) return;

    return this.$$createElement({
      tagName,
      nodeId: `b-${tool.getId()}`, // 运行时生成，使用 b- 前缀
    });
  }

  createElementNS(ns, tagName) {
    // 不支持真正意义上的 createElementNS，转成调用 createElement
    return this.createElement(tagName);
  }

  createTextNode(content) {
    content = `${content}`;

    return this.$$createTextNode({
      content,
      nodeId: `b-${tool.getId()}`, // 运行时生成，使用 b- 前缀
    });
  }

  createComment() {
    // 忽略注释内容的传入
    return this.$$createComment({
      nodeId: `b-${tool.getId()}`, // 运行时生成，使用 b- 前缀
    });
  }

  createDocumentFragment() {
    return Element.$$create({
      tagName: 'documentfragment',
      nodeId: `b-${tool.getId()}`, // 运行时生成，使用 b- 前缀
      nodeType: Node.DOCUMENT_FRAGMENT_NODE,
    }, this.$_tree);
  }

  createEvent() {
    const { window } = cache[this.$_pageId];

    return new window.CustomEvent();
  }

  addEventListener(eventName, handler, options) {
    this.documentElement.addEventListener(eventName, handler, options);
  }

  removeEventListener(eventName, handler, isCapture) {
    this.documentElement.removeEventListener(eventName, handler, isCapture);
  }

  dispatchEvent(evt) {
    this.documentElement.dispatchEvent(evt);
  }

  hasFocus() {
    return false;
  }
}

module.exports = Document;
