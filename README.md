# 夕阳灯模拟器 (Halo Light Simulator)

静态单灯、投射墙面效果的第一版。通过左侧面板调节参数，右侧画布实时预览。

## 运行

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址（如 `http://localhost:5173`）。

## 参数说明

- **光斑形态**：束角(15°~45°)、畸变率、中心光强
- **色彩渐变**：色相偏移度、过渡梯度、光谱纯度
- **边缘质感**：半影区宽度、色散条纹、漫反射率
- **场景**：投射距离

详见 [docs/DESIGN.md](docs/DESIGN.md)。

## 技术栈

- Vite + TypeScript
- Canvas 2D 绘制
