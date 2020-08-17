const cache = require('./cache');

/**
 * 驼峰转连字符
 */
function toDash(str) {
  return str.replace(/[A-Z]/g, all => `-${all.toLowerCase()}`);
}

/**
 * 连字符转驼峰
 */
function toCamel(str) {
  return str.replace(/-([a-zA-Z])/g, (all, $1) => $1.toUpperCase());
}

/**
 * 获取唯一 id
 */
let seed = +new Date();
function getId() {
  return seed++;
}

/**
 * 节流，一个同步流中只调用一次该函数
 */
const waitFuncSet = new Set();
function throttle(func) {
  return () => {
    if (waitFuncSet.has(func)) return;

    waitFuncSet.add(func);

    Promise.resolve().then(() => {
      if (waitFuncSet.has(func)) {
        waitFuncSet.delete(func);
        func();
      }
    })
      .catch(console.error);
  };
}

/**
 * 清空节流缓存
 */
function flushThrottleCache() {
  waitFuncSet.forEach(waitFunc => waitFunc && waitFunc());
  waitFuncSet.clear();
}

/**
 * 补全 url
 */
function completeURL(url, origin, notTransHttps) {
  // 处理 url 前缀
  if (url.indexOf('//') === 0) {
    url = `https:${url}`;
  } else if (url[0] === '/') {
    url = origin + url;
  }

  if (!notTransHttps && url.indexOf('http:') === 0) {
    url = url.replace(/^http:/ig, 'https:');
  }

  return url;
}

/**
 * 解码特殊字符
 */
function decodeContent(content) {
  return content
    .replace(/&nbsp;/g, '\u00A0')
    .replace(/&ensp;/g, '\u2002')
    .replace(/&emsp;/g, '\u2003')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&');
}

/**
 * 判断该标签在小程序中是否支持
 */
const NOT_SUPPORT_TAG_NAME_LIST = ['IFRAME'];
function isTagNameSupport(tagName) {
  return NOT_SUPPORT_TAG_NAME_LIST.indexOf(tagName) === -1;
}

/**
 * 处理 innerHTML/outerHTML 的属性值过滤
 */
function escapeForHtmlGeneration(value) {
  return value.replace(/"/g, '&quot;');
}

function throwNotSupport() {
  throw Error('Not supported');
}

function warnNotSupport() {
  console.warn('Not supported', Error().stack);
}

module.exports = {
  toDash,
  toCamel,
  getId,
  throttle,
  flushThrottleCache,
  completeURL,
  decodeContent,
  isTagNameSupport,
  escapeForHtmlGeneration,
  throwNotSupport,
  warnNotSupport,
};
