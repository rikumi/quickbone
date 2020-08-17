# QuickBone

基于 Kbone 的轻量化小程序 dom 组件

## 背景

[Kbone](https://github.com/Tencent/kbone) 是一个重量级的 Web 转小程序脚手架，它可以基于现有的 Web 项目生成小程序项目，但 Kbone 托管了整个小程序或整个小程序页面，使 Web 和小程序混合开发极其不便。

QuickBone 是基于 Kbone 构建的轻量化小程序组件，从 Kbone 中剔除了小程序级、页面级的配置项和生成逻辑，专注于做一个小程序组件。页面可以在合适的时机初始化组件，并在组件内部执行打包好的 Web 项目，真正做到**对现有小程序零侵入**。

因此，在 QuickBone 中，你终于可以**在小程序原生或第三方框架的开发方式中，无缝嵌入 Web 项目代码，让 Web 项目在你想要的时候以你想要的方式加载，而无需关注实现原理**。

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
        // 参见 Kbone 的配置：https://wechat-miniprogram.github.io/kbone/docs/guide/tutorial.html
      },
      module: {
        rules: baseWebpackConfig.module.rules.map((rule) => {
          rule.use = rule.use.map((loader) => {
            if (loader.loader === 'url-loader') {
              // 小程序 WXSS 不能引用代码包里的图片，只能全都 base64 了
              loader.options = {
                limit: 1048576,
                name: '[name]_[hash:hex:6].[ext]',
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
        new MpWebpackPlugin(), // 编译时零配置，只保留 Kbone 的部分运行时配置，在 wxml 中使用组建时设置
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
    <quickbone base-url="https://docs.qq.com/desktop/m/" query="{{ options }}" bind:ready="onQuickBoneReady"></quickbone>
    ```

    ```js
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
