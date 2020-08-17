# QuickBone

基于 Kbone 的轻量化小程序 dom 组件

## 背景

[Kbone](https://github.com/Tencent/kbone) 是一个重量级的 Web 转小程序脚手架，它可以基于现有的 Web 项目生成小程序项目，但 Kbone 托管了整个小程序或整个小程序页面，使 Web 和小程序混合开发极其不便。

QuickBone 是基于 Kbone 构建的轻量化小程序组件，从 Kbone 中剔除了小程序级、页面级的配置项和生成逻辑，专注于做一个小程序组件。

## 特点

- 继承 Kbone 完整 DOM/BOM 实现
- 根据实际使用场景，补全了绝大多数缺失的全局对象和 WebSocket 类
- 不做脚手架，将小程序和小程序页面的控制权还给开发者
  - 不限制项目结构、小程序分包，快速融入现有项目
  - 不限制页面内其它组件、样式、生命周期，快速复用现有 `web-view` 页面逻辑
  - 初始化逻辑清晰，`window`、`document` 双向透明，加载过程和加载时机可控，灵活性接近 `iframe`

## 用法

1.  在 Web 项目中安装 `quickbone`，引入零配置的 `quickbone/webpack-plugin`：

    ```js
    const QuickBonePlugin = require('quickbone/webpack-plugin');

    module.exports = {
      entry: {
        // 入口文件中无需像 Kbone 一样指定 createApp，直接渲染页面，与 Web 一致
        'demo-web': path.resolve(__dirname, '../src/main.tsx'),
      },
      output: {
        // 打包输出只有 js/wxss 文件
        path: path.resolve(__dirname, '../../my-miniprogram/pages/demo'),
        filename: '[name].js',
      },
      target: 'web',
      optimization: {
        runtimeChunk: false, // 必需字段，不能修改
        splitChunks: false,
        minimizer: [
          // 请参见 Kbone 的配置：https://wechat-miniprogram.github.io/kbone/docs/guide/tutorial.html
        ],
      },
      module: {
        rules: baseWebpackConfig.module.rules.map((rule) => {
          rule.use = rule.use.map((loader) => {
            if (loader.loader === 'url-loader') {
              // 小程序 WXSS 不能引用代码包里的图片，只能全都 base64 了
              loader.options = {
                limit: 1048576,
                emitFile: false,
              };
            }
            return loader;
          });
          return rule;
        }),
      },
      plugins: [
        new webpack.DefinePlugin({
          process.env.MINI_PROGRAM: 'true', // 注入环境变量，用于业务代码判断
        }),
        new MiniCssExtractPlugin({
          filename: '[name].wxss',
        }),
        new QuickBonePlugin(), // 零配置，用于转换样式并给 JS 文件外包裹一层函数
      ],
    };
    ```

2.  在小程序项目中安装 `quickbone`，并复制到合适位置（建议使用 postinstall 脚本代替开发者工具中的 “构建 NPM”）：

    ```js
    // package.json
    {
      "scripts": {
        "postinstall": "rm -rf quickbone; cp -r node_modules/quickbone/src quickbone"
      },
      "dependencies": {
        "quickbone": "latest"
      }
    }
    ```

3.  构建 Web 项目，得到 `/pages/demo/demo-web.js` 和 `/pages/demo/demo-web.wxss`，在小程序页面中初始化组件并执行 Web 代码：

    ```js
    // /pages/demo/demo.json
    {
      "usingComponents": {
        "quickbone": "../../quickbone"
      }
    }
    ```

    ```xml
    <!-- /pages/demo/demo.wxml -->
    <!-- 可自行决定合适的时机渲染 quickbone 组件 -->
    <quickbone base-url="https://docs.qq.com/desktop/m/" query="{{ options }}" bind:ready="onQuickBoneReady"></quickbone>
    ```

    ```css
    /* /pages/demo/demo.wxss */
    @import './demo-web.wxss';
    ```

    ```js
    // /pages/demo/demo.js
    Page({
      data: {
        options: {},
      },
      onLoad(options) {
        this.setData({ options });
      },
      onQuickBoneReady(e) {
        const { window, document } = e.detail;
        require('./demo-web.js')(window, document);
      },
    });
    ```

## 组件参数

- `base-url`: 页面的地址，不含参数（search 和 hash）；
- `query`: 页面的参数对象，为了兼容小程序 `options` 格式，其中所有的 value 应当经过一次 `encodeURIComponent`；
- `wx-component`: 同 Kbone [`runtime.wxComponent`](https://wechat-miniprogram.github.io/kbone/docs/config/#runtime-wxcomponent)；
- `persist-cookie`: 是否持久化页面内的 Cookie，默认为 `true`；
- `dom-sub-tree-level`: 同 Kbone [`optimization.domSubTreeLevel`](https://wechat-miniprogram.github.io/kbone/docs/config/#optimization-domsubtreelevel)；
- `set-data-mode`: 同 Kbone [`optimization.setDataMode`](https://wechat-miniprogram.github.io/kbone/docs/config/#optimization-setdatamode)；

其它 Kbone 配置不再支持，均采用默认实现；[DOM/BOM 扩展 API](https://wechat-miniprogram.github.io/kbone/docs/domextend/) 中，目前仅保证支持 `window.$$trigger`、`window.$$getComputedStyle`、`dom.$$getBoundingClientRect`、`canvas.$$prepare`，其它 Web 中不存在的特殊接口、事件均已删除或有可能会在未来版本中被删除。

## 组件事件

- `bind:ready`: 虚拟 DOM/BOM 创建完成的事件，`e.detail` 为 `{ window, document }`；
- `bind:navigate`: 页面试图进行跳转或打开新页面的事件（默认不会做任何处理），`e.detail` 为 `{ url, type }`，其中 `type === 'open'` 为调用 `window.open`；`type === 'jump'` 为当前页跳转。

## 注意点

1.  由于需要依赖页面中定义的事件，目前不会自动监听页面的全局滚动、下拉刷新和上拉加载，如需监听，可以在组件 `bind:ready` 中保存 `window` 对象，然后参考 Kbone 中的页面事件写法：

    ```js
    onPageScroll({ scrollTop }) {
      if (this.window) {
        this.window.document.documentElement.$$scrollTop = scrollTop || 0;
        this.window.$$trigger('scroll');
      }
    },
    onPullDownRefresh() {
      if (this.window) {
        this.window.$$trigger('pulldownrefresh');
      }
    },
    onReachBottom() {
      if (this.window) {
        this.window.$$trigger('reachbottom');
      }
    },
    ```

2.  Kbone 相关的注意点可以参见 [Kbone Q&A](https://wechat-miniprogram.github.io/kbone/docs/qa/)，相关限制不再赘述。
