const History = require('./bom/history');
const Location = require('./bom/location');
const Navigator = require('./bom/navigator');
const Performance = require('./bom/performance');
const Screen = require('./bom/screen');
const { SessionStorage, LocalStorage } = require('./bom/storage');
const WebSocket = require('./bom/websocket');
const OriginalXMLHttpRequest = require('./bom/xml-http-request');
const Document = require('./document');
const OriginalCustomEvent = require('./event/custom-event');
const Event = require('./event/event');
const EventTarget = require('./event/event-target');
const Attribute = require('./node/attribute');
const ClassList = require('./node/class-list');
const Comment = require('./node/comment');
const Element = require('./node/element');
const Node = require('./node/node');
const Style = require('./node/style');
const TextNode = require('./node/text-node');
const WebViewMiniProgram = require('./sdk/mini-program');
const cache = require('./util/cache');
const tool = require('./util/tool');
const { throwNotSupport, warnNotSupport } = require('./util/tool');

let lastRafTime = 0;
const WINDOW_PROTOTYPE_MAP = {
  location: Location.prototype,
  navigator: Navigator.prototype,
  performance: Performance.prototype,
  screen: Screen.prototype,
  history: History.prototype,
  localStorage: LocalStorage.prototype,
  sessionStorage: SessionStorage.prototype,
  event: Event.prototype,
};
const ELEMENT_PROTOTYPE_MAP = {
  attribute: Attribute.prototype,
  classList: ClassList.prototype,
  style: Style.prototype,
};
const subscribeMap = {};
const globalObject = {};

class Window extends EventTarget {
  constructor(pageId) {
    super();

    const timeOrigin = +new Date();
    const that = this;

    this.$_pageId = pageId;

    this.$_outerHeight = 0;
    this.$_outerWidth = 0;
    this.$_innerHeight = 0;
    this.$_innerWidth = 0;

    this.$_location = new Location(pageId);
    this.$_navigator = new Navigator();
    this.$_screen = new Screen();
    this.$_history = new History(this.$_location);
    this.$_localStorage = new LocalStorage(this);
    this.$_sessionStorage = new SessionStorage(this);
    this.$_performance = new Performance(timeOrigin);

    this.$_nowFetchingWebviewInfoPromise = null; // 正在拉取 webview 端信息的 promise 实例

    this.$_fetchDeviceInfo();
    this.$_initInnerEvent();

    // 补充实例的属性，用于 'xxx' in XXX 判断
    this.onhashchange = null;

    this.$_elementConstructor = function HTMLElement(...args) {
      return Element.$$create(...args);
    };
    this.$_customEventConstructor = class CustomEvent extends OriginalCustomEvent {
      constructor(name = '', options = {}) {
        options.timeStamp = +new Date() - timeOrigin;
        super(name, options);
      }
    };
    this.$_xmlHttpRequestConstructor = class XMLHttpRequest extends OriginalXMLHttpRequest {
      constructor() {
        super(that);
      }
    };

    // react 环境兼容
    this.HTMLIFrameElement = function () { };

    console.log(
      '%cQuickBone',
      'color:#fff;font-weight:bold;background:#f28c06;padding:2px 5px',
      'global.window:',
      this
    );
  }

  /**
     * 初始化内部事件
     */
  $_initInnerEvent() {
    // 监听 location 的事件
    this.$_location.addEventListener('hashchange', ({ oldURL, newURL }) => {
      this.$$trigger('hashchange', {
        event: new Event({
          name: 'hashchange',
          target: this,
          eventPhase: Event.AT_TARGET,
          $$extra: {
            oldURL,
            newURL,
          },
        }),
        currentTarget: this,
      });
    });

    // 监听 history 的事件
    this.$_history.addEventListener('popstate', ({ state }) => {
      this.$$trigger('popstate', {
        event: new Event({
          name: 'popstate',
          target: this,
          eventPhase: Event.AT_TARGET,
          $$extra: { state },
        }),
        currentTarget: this,
      });
    });

    // 监听滚动事件
    this.addEventListener('scroll', () => {
      const { document } = this;
      if (document) {
        // 记录最近一次滚动事件触发的时间戳
        document.documentElement.$$scrollTimeStamp = +new Date();
        this.$_scrollTop = document.documentElement.$$scrollTop;
      }
    });
  }

  /**
     * 拉取设备参数
     */
  $_fetchDeviceInfo() {
    try {
      const info = wx.getSystemInfoSync();

      this.$_outerHeight = info.screenHeight;
      this.$_outerWidth = info.screenWidth;
      this.$_innerHeight = info.windowHeight;
      this.$_innerWidth = info.windowWidth;
      this.$_devicePixelRatio = info.pixelRatio;

      this.$_screen.$$reset(info);
      this.$_navigator.$$reset(info);
    } catch (err) {
      // ignore
    }
  }

  /**
     * 拉取处理切面必要的信息
     */
  $_getAspectInfo(descriptor) {
    if (!descriptor || typeof descriptor !== 'string') return;

    descriptor = descriptor.split('.');
    const main = descriptor[0];
    const sub = descriptor[1];
    let method = descriptor[1];
    let type = descriptor[2];
    let prototype;

    // 找出对象原型
    if (main === 'window') {
      if (WINDOW_PROTOTYPE_MAP[sub]) {
        prototype = WINDOW_PROTOTYPE_MAP[sub];
        method = type;
        type = descriptor[3];
      } else {
        prototype = Window.prototype;
      }
    } else if (main === 'document') {
      prototype = Document.prototype;
    } else if (main === 'element') {
      if (ELEMENT_PROTOTYPE_MAP[sub]) {
        prototype = ELEMENT_PROTOTYPE_MAP[sub];
        method = type;
        type = descriptor[3];
      } else {
        prototype = Element.prototype;
      }
    } else if (main === 'textNode') {
      prototype = TextNode.prototype;
    } else if (main === 'comment') {
      prototype = Comment.prototype;
    }

    return { prototype, method, type };
  }

  /**
     * 获取全局共享对象
     */
  get $$global() {
    return globalObject;
  }

  /**
     * 销毁实例
     */
  $$destroy() {
    super.$$destroy();

    const pageId = this.$_pageId;

    Object.keys(subscribeMap).forEach((name) => {
      const handlersMap = subscribeMap[name];
      if (handlersMap[pageId]) handlersMap[pageId] = null;
    });
  }

  /**
     * 小程序端的 getComputedStyle 实现
     * https://developers.weixin.qq.com/miniprogram/dev/api/wxml/NodesRef.fields.html
     */
  $$getComputedStyle(dom, computedStyle = []) {
    tool.flushThrottleCache(); // 先清空 setData
    return new Promise((resolve, reject) => {
      if (dom.tagName === 'BODY') {
        this.$$createSelectorQuery().select('.miniprogram-root')
          .fields({ computedStyle }, res => (res ? resolve(res) : reject()))
          .exec();
      } else {
        this.$$createSelectorQuery().select(`.miniprogram-root >>> .node-${dom.$$nodeId}`)
          .fields({ computedStyle }, res => (res ? resolve(res) : reject()))
          .exec();
      }
    });
  }

  /**
     * 强制清空 setData 缓存
     */
  $$forceRender() {
    tool.flushThrottleCache();
  }

  /**
     * 触发节点事件
     */
  $$trigger(eventName, options = {}) {
    if (eventName === 'error' && typeof options.event === 'string') {
      // 此处触发自 App.onError 钩子
      const errStack = options.event;
      const errLines = errStack.split('\n');
      let message = '';
      for (let i = 0, len = errLines.length; i < len; i++) {
        const line = errLines[i];
        if (line.trim().indexOf('at') !== 0) {
          message += (`${line}\n`);
        } else {
          break;
        }
      }

      const error = new Error(message);
      error.stack = errStack;
      options.event = new this.$_customEventConstructor('error', {
        target: this,
        $$extra: {
          message,
          filename: '',
          lineno: 0,
          colno: 0,
          error,
        },
      });
      options.args = [message, error];

      // window.onerror 比较特殊，需要调整参数
      if (typeof this.onerror === 'function' && !this.onerror.$$isOfficial) {
        const oldOnError = this.onerror;
        this.onerror = (event, message, error) => {
          oldOnError.call(this, message, '', 0, 0, error);
        };
        this.onerror.$$isOfficial = true; // 标记为官方封装的方法
      }
    }

    super.$$trigger(eventName, options);
  }

  /**
     * 获取原型
     */
  $$getPrototype(descriptor) {
    if (!descriptor || typeof descriptor !== 'string') return;

    descriptor = descriptor.split('.');
    const main = descriptor[0];
    const sub = descriptor[1];

    if (main === 'window') {
      if (WINDOW_PROTOTYPE_MAP[sub]) {
        return WINDOW_PROTOTYPE_MAP[sub];
      } if (!sub) {
        return Window.prototype;
      }
    } else if (main === 'document') {
      if (!sub) {
        return Document.prototype;
      }
    } else if (main === 'element') {
      if (ELEMENT_PROTOTYPE_MAP[sub]) {
        return ELEMENT_PROTOTYPE_MAP[sub];
      } if (!sub) {
        return Element.prototype;
      }
    } else if (main === 'textNode') {
      if (!sub) {
        return TextNode.prototype;
      }
    } else if (main === 'comment') {
      if (!sub) {
        return Comment.prototype;
      }
    }
  }

  /**
     * 扩展 dom/bom 对象
     */
  $$extend(descriptor, options) {
    if (!descriptor || !options || typeof descriptor !== 'string' || typeof options !== 'object') return;

    const prototype = this.$$getPrototype(descriptor);
    const keys = Object.keys(options);

    if (prototype) keys.forEach(key => prototype[key] = options[key]);
  }

  /**
     * 对 dom/bom 对象方法追加切面方法
     */
  $$addAspect(descriptor, func) {
    if (!descriptor || !func || typeof descriptor !== 'string' || typeof func !== 'function') return;

    const { prototype, method, type } = this.$_getAspectInfo(descriptor);

    // 处理切面
    if (prototype && method && type) {
      const methodInPrototype = prototype[method];
      if (typeof methodInPrototype !== 'function') return;

      // 重写原始方法
      if (!methodInPrototype.$$isHook) {
        prototype[method] = function (...args) {
          const beforeFuncs = prototype[method].$$before || [];
          const afterFuncs = prototype[method].$$after || [];

          if (beforeFuncs.length) {
            for (const beforeFunc of beforeFuncs) {
              const isStop = beforeFunc.apply(this, args);
              if (isStop) return;
            }
          }

          const res = methodInPrototype.apply(this, args);

          if (afterFuncs.length) {
            for (const afterFunc of afterFuncs) {
              afterFunc.call(this, res);
            }
          }

          return res;
        };
        prototype[method].$$isHook = true;
        prototype[method].$$originalMethod = methodInPrototype;
      }

      // 追加切面方法
      if (type === 'before') {
        prototype[method].$$before = prototype[method].$$before || [];
        prototype[method].$$before.push(func);
      } else if (type === 'after') {
        prototype[method].$$after = prototype[method].$$after || [];
        prototype[method].$$after.push(func);
      }
    }
  }

  /**
     * 删除对 dom/bom 对象方法追加前置/后置处理
     */
  $$removeAspect(descriptor, func) {
    if (!descriptor || !func || typeof descriptor !== 'string' || typeof func !== 'function') return;

    const { prototype, method, type } = this.$_getAspectInfo(descriptor);

    // 处理切面
    if (prototype && method && type) {
      const methodInPrototype = prototype[method];
      if (typeof methodInPrototype !== 'function' || !methodInPrototype.$$isHook) return;

      // 移除切面方法
      if (type === 'before' && methodInPrototype.$$before) {
        methodInPrototype.$$before.splice(methodInPrototype.$$before.indexOf(func), 1);
      } else if (type === 'after' && methodInPrototype.$$after) {
        methodInPrototype.$$after.splice(methodInPrototype.$$after.indexOf(func), 1);
      }

      if (
        (!methodInPrototype.$$before || !methodInPrototype.$$before.length)
        && (!methodInPrototype.$$after || !methodInPrototype.$$after.length)
      ) {
        prototype[method] = methodInPrototype.$$originalMethod;
      }
    }
  }

  /**
     * 订阅广播事件
     */
  $$subscribe(name, handler) {
    if (typeof name !== 'string' || typeof handler !== 'function') return;

    const pageId = this.$_pageId;
    subscribeMap[name] = subscribeMap[name] || {};
    subscribeMap[name][pageId] = subscribeMap[name][pageId] || [];
    subscribeMap[name][pageId].push(handler);
  }

  /**
     * 取消订阅广播事件
     */
  $$unsubscribe(name, handler) {
    const pageId = this.$_pageId;

    if (typeof name !== 'string' || !subscribeMap[name] || !subscribeMap[name][pageId]) return;

    const handlers = subscribeMap[name][pageId];
    if (!handler) {
      // 取消所有 handler 的订阅
      handlers.length = 0;
    } else if (typeof handler === 'function') {
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    }
  }

  /**
     * 发布广播事件
     */
  $$publish(name, data) {
    if (typeof name !== 'string' || !subscribeMap[name]) return;

    Object.keys(subscribeMap[name]).forEach((pageId) => {
      const handlers = subscribeMap[name][pageId];
      if (handlers && handlers.length) {
        handlers.forEach((handler) => {
          if (typeof handler !== 'function') return;

          try {
            handler.call(null, data);
          } catch (err) {
            console.error(err);
          }
        });
      }
    });
  }

  /**
   * 全局构造方法
   */
  get Array() {
    return Array;
  }

  get ArrayBuffer() {
    return ArrayBuffer;
  }

  get Boolean() {
    return Boolean;
  }

  get CustomEvent() {
    return this.$_customEventConstructor;
  }

  get DataView() {
    return typeof DataView !== 'undefined' ? DataView : undefined;
  }

  get Date() {
    return Date;
  }

  get Element() {
    return Element;
  }

  get Error() {
    return Error;
  }

  get EvalError() {
    return EvalError;
  }

  get Event() {
    return Event;
  }

  get Float32Array() {
    return Float32Array;
  }

  get Float64Array() {
    return Float64Array;
  }

  get Function() {
    return Function;
  }

  get HTMLElement() {
    return this.$_elementConstructor;
  }

  get Image() {
    return this.document.$$imageConstructor;
  }

  get Infinity() {
    return Infinity;
  }

  get Int16Array() {
    return Int16Array;
  }

  get Int32Array() {
    return Int32Array;
  }

  get Int8Array() {
    return Int8Array;
  }

  get JSON() {
    return JSON;
  }

  get Map() {
    return Map;
  }

  get Math() {
    return Math;
  }

  get NaN() {
    return NaN;
  }

  get Node() {
    return Node;
  }

  get Number() {
    return Number;
  }

  get Object() {
    return Object;
  }

  get Promise() {
    return Promise;
  }

  get Proxy() {
    return typeof Proxy !== 'undefined' ? Proxy : undefined;
  }

  get RangeError() {
    return RangeError;
  }

  get ReferenceError() {
    return ReferenceError;
  }

  get Reflect() {
    return Reflect;
  }

  get RegExp() {
    return RegExp;
  }

  get Set() {
    return Set;
  }

  get SharedWorker() {
    throwNotSupport();
  }

  get String() {
    return String;
  }

  get SVGElement() {
    // 不作任何实现，只作兼容使用
    console.warn('window.SVGElement is not supported');
    return function () {};
  }

  get Symbol() {
    return Symbol;
  }

  get SyntaxError() {
    return SyntaxError;
  }

  get TypeError() {
    return TypeError;
  }

  get URIError() {
    return URIError;
  }

  get Uint16Array() {
    return Uint16Array;
  }

  get Uint32Array() {
    return Uint32Array;
  }

  get Uint8Array() {
    return Uint8Array;
  }

  get Uint8ClampedArray() {
    return Uint8ClampedArray;
  }

  get WeakMap() {
    return WeakMap;
  }

  get WeakSet() {
    return WeakSet;
  }

  get WebSocket() {
    return WebSocket;
  }

  get WeixinJSBridge() {
    return {
      invoke: () => { },
    };
  }

  get Worker() {
    throwNotSupport();
  }

  get XMLHttpRequest() {
    return this.$_xmlHttpRequestConstructor;
  }

  /**
   * 全局对象
   */
  get addEventListener() {
    // 这个 addEventListener 很特殊，需要默认绑定到 window 上，这里在取出的一瞬间就绑定
    return EventTarget.prototype.addEventListener.bind(this);
  }

  get clearInterval() {
    return clearInterval.bind(null);
  }

  get clearTimeout() {
    return clearTimeout.bind(null);
  }

  get console() {
    return console;
  }

  get decodeURI() {
    return decodeURI;
  };

  get decodeURIComponent() {
    return decodeURIComponent;
  };

  get devicePixelRatio() {
    return this.$_devicePixelRatio;
  }

  get dispatchEvent() {
    // 同 addEventListener
    return EventTarget.prototype.dispatchEvent.bind(this);
  }

  get document() {
    return cache[this.$_pageId].document || null;
  }

  get encodeURI() {
    return encodeURI;
  };

  get encodeURIComponent() {
    return encodeURIComponent;
  };

  get escape() {
    return escape;
  };

  get frames() {
    return this;
  }

  get frameElement() {
    return null;
  }

  get global() {
    return this;
  }

  get globalThis() {
    return this;
  }

  get history() {
    return this.$_history;
  }

  get innerHeight() {
    return this.$_innerHeight;
  }

  get innerWidth() {
    return this.$_innerWidth;
  }

  get isFinite() {
    return isFinite;
  };

  get isNaN() {
    return isNaN;
  };

  get isSecureContext() {
    return true;
  }

  get length() {
    return 1;
  }

  get localStorage() {
    return this.$_localStorage;
  }

  get location() {
    return this.$_location;
  }

  set location(href) {
    this.$_location.href = href;
  }

  get locationbar() {
    return { visible: false };
  }

  get menubar() {
    return { visible: false };
  }

  get mqq() {
    return false;
  }

  get name() {
    return '';
  }

  get navigator() {
    return this.$_navigator;
  }

  get opener() {
    return null;
  }

  get outerHeight() {
    return this.$_outerHeight;
  }

  get outerWidth() {
    return this.$_outerWidth;
  }

  get pageXOffset() {
    return 0;
  }

  get pageYOffset() {
    return this.$_scrollTop;
  }

  get parent() {
    return this;
  }

  get parseFloat() {
    return parseFloat;
  };

  get parseInt() {
    return parseInt;
  };

  get performance() {
    return this.$_performance;
  }

  get personalbar() {
    return { visible: false };
  }

  get removeEventListener() {
    // 同 addEventListener
    return EventTarget.prototype.removeEventListener.bind(this);
  }

  get root() {
    return this;
  }

  get screen() {
    return this.$_screen;
  }

  get screenLeft() {
    return 0;
  }

  get screenTop() {
    return 0;
  }

  get screenX() {
    return 0;
  }

  get screenY() {
    return 0;
  }

  get scrollbars() {
    return { visible: false };
  }

  get scrollX() {
    return 0;
  }

  get scrollY() {
    return 0;
  }

  get self() {
    return this;
  }

  get sessionStorage() {
    return this.$_sessionStorage;
  }

  get setImmediate() {
    return fn => setTimeout(fn, 0);
  };

  get setInterval() {
    return setInterval.bind(null);
  }

  get setTimeout() {
    return setTimeout.bind(null);
  }

  get status() {
    return '';
  }

  get statusbar() {
    return { visible: false };
  }

  get toolbar() {
    return { visible: false };
  }

  get top() {
    return this;
  }

  get undefined() {
    return undefined;
  };

  get unescape() {
    return unescape;
  };

  get window() {
    return this;
  }

  get wx() {
    return {
      ...wx,
      miniProgram: new WebViewMiniProgram(this),
    };
  }

  get __wxjs_environment() {
    return 'miniprogram';
  }

  get 0() {
    return this;
  }

  /**
   * 全局方法
   */
  alert(content) {
    wx.showModal({ title: '提示', content });
  }

  blur() {
    wx.hideKeyboard();
  }

  cancelAnimationFrame(timeId) {
    return clearTimeout(timeId);
  }

  close() {
    wx.navigateBack({
      delta: 1,
    });
  }

  confirm() {
    throwNotSupport();
  }

  eval() {
    throwNotSupport();
  }

  focus() {
    warnNotSupport();
  }

  getComputedStyle() {
    warnNotSupport();
    return {
      // vue transition 组件使用
      transitionDelay: '',
      transitionDuration: '',
      animationDelay: '',
      animationDuration: '',
    };
  }

  getSelection() {
    throwNotSupport();
  }

  matchMedia() {
    throwNotSupport();
  }

  moveBy() {
    warnNotSupport();
  }

  moveTo() {
    warnNotSupport();
  }

  open(url) {
    // 不支持 windowName 和 windowFeatures
    this.location.$$open(url);
  }

  postMessage(data) {
    this.$$trigger('message', {
      event: new Event({
        name: 'message',
        target: this,
        currentTarget: this,
        eventPhase: Event.AT_TARGET,
        data,
        origin: this.location.origin,
      }),
    });
  }

  print() {
    warnNotSupport();
  }

  prompt() {
    throwNotSupport();
  }

  releaseEvents() {
    warnNotSupport();
  }

  requestAnimationFrame(callback) {
    if (typeof callback !== 'function') return;

    const now = new Date();
    const nextRafTime = Math.max(lastRafTime + 16, now);
    return setTimeout(() => {
      callback(nextRafTime);
      lastRafTime = nextRafTime;
    }, nextRafTime - now);
  }

  resizeBy() {
    warnNotSupport();
  }

  resizeTo() {
    warnNotSupport();
  }

  scroll() {
    warnNotSupport();
  }

  scrollBy(left, top, behavior) {
    if (typeof left === 'object') ({ left, top, behavior } = left);

    wx.pageScrollTo({
      scrollTop: top + this.pageYOffset,
      duration: behavior === 'smooth' ? 300 : 0,
    });
  }

  scrollTo(left, top, behavior) {
    if (typeof left === 'object') ({ left, top, behavior } = left);

    wx.pageScrollTo({
      scrollTop: top,
      duration: behavior === 'smooth' ? 300 : 0,
    });
  }

  stop() {
    warnNotSupport();
  }

  Storage() {
    // 适配 steamer-browserutils setItem()
    warnNotSupport();
  }
}

module.exports = Window;
