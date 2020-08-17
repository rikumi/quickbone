const cache = require('../util/cache');
const Pool = require('../util/pool');
const tool = require('../util/tool');
const { toCamel } = require('../util/tool');
const styleList = require('./style-list');

const pool = new Pool();

/**
 * 解析样式串
 */
function parse(styleText) {
  const rules = {};

  if (styleText) {
    styleText = tool.decodeContent(styleText);
    styleText = styleText.replace(/url\([^)]+\)/ig, all => all.replace(/;/ig, ':#||#:')); // 先处理值里面的分号
    styleText.split(';').forEach((rule) => {
      rule = rule.trim();
      if (!rule) return;

      const split = rule.indexOf(':');
      if (split === -1) return;

      const name = rule.substr(0, split).trim();
      rules[name] = rule.substr(split + 1).replace(/:#\|\|#:/ig, ';')
        .trim();
    });
  }

  return rules;
}

class Style {
  constructor(onUpdate) {
    this.$$init(onUpdate);
  }

  /**
     * 创建实例
     */
  static $$create(onUpdate) {
    // 复用 dom 扩展对象
    const instance = pool.get();

    if (instance) {
      instance.$$init(onUpdate);
      return instance;
    }

    return new Style(onUpdate);
  }

  /**
     * 初始化实例
     */
  $$init(onUpdate) {
    this.$_store = {};
    this.$_doUpdate = onUpdate || (() => {});
    this.$_disableCheckUpdate = false; // 是否禁止检查更新
  }

  /**
     * 销毁实例
     */
  $$destroy() {
    this.$_doUpdate = null;
    this.$_disableCheckUpdate = false;
    delete this.$_store;
  }

  /**
     * 回收实例
     */
  $$recycle() {
    this.$$destroy();

    // 复用 dom 扩展对象
    pool.add(this);
  }

  /**
     * 检查更新
     */
  $_checkUpdate() {
    if (!this.$_disableCheckUpdate) {
      this.$_doUpdate();
    }
  }

  /**
     * 对外属性和方法
     */
  get cssText() {
    const joinText = Object.keys(this.$_store)
      .filter(name => this.$_store[name])
      .map(name => `${name}: ${this.$_store[name]};`)
      .join(' ');
    return joinText || '';
  }

  set cssText(styleText) {
    if (typeof styleText !== 'string') return;
    styleText = styleText.replace(/"/g, '\'');

    // 解析样式
    const rules = parse(styleText);

    this.$_disableCheckUpdate = true; // 将每条规则的设置合并为一次更新
    for (const name in rules) {
      this.$_store[name] = rules[name];
    }
    this.$_disableCheckUpdate = false;
    this.$_checkUpdate();
  }

  getPropertyValue(name) {
    if (typeof name !== 'string') return '';
    return this.$_store[name] || '';
  }

  removeProperty(name) {
    if (this.$_store[name]) {
      this.$_store[name] = undefined;
      this.$_checkUpdate();
    }
  }

  setProperty(name, value) {
    if (this.$_store[name] !== value) {
      this.$_store[name] = value;
      this.$_checkUpdate();
    }
  }
}

/**
 * 对于标准属性，设置成 getter、setter
 * 对于非标准属性，没办法了，不能用 Proxy，因此只能支持 getPropertyValue、setProperty、removeProperty
 */
const properties = {};
styleList.forEach((name) => {
  properties[toCamel(name)] = {
    get() {
      return this.getPropertyValue(name);
    },
    set(value) {
      this.setProperty(name, value);
    },
  };
});

Object.defineProperties(Style.prototype, properties);

module.exports = Style;
