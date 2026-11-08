# -*- coding: utf-8 -*-
"""生成临时 HTML（在原工具基础上自动载入示例图并模拟操作），供无头浏览器截图验证 UI。

用法： python make_screenshot_page.py base|flip|picker|size|palette|export
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(HERE, "拼豆图纸工具.html")

MODES = {
    "base": "",
    "flip": """
      document.getElementById('flip').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    """,
    "picker": """
      document.querySelector('#tools button[data-t="picker"]')
              .dispatchEvent(new MouseEvent('click',{bubbles:true}));
      setTimeout(function(){
        var cv=document.getElementById('grid'), r=cv.getBoundingClientRect();
        var csx=r.width/32, csy=r.height/32;
        cv.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,
          clientX:r.left+10*csx+csx/2, clientY:r.top+16*csy+csy/2}));
        window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        var aside=document.getElementById('side'); if(aside) aside.scrollTop=aside.scrollHeight;
      },120);
    """,
    "size": """
      var s=document.getElementById('sideLen'); s.value=48; s.dispatchEvent(new Event('change'));
    """,
    # 打开色卡浮层（新功能截图用）
    "palette": """
      var aside=document.getElementById('side'); if(aside) aside.scrollTop=aside.scrollHeight;
      setTimeout(function(){ document.getElementById('paintRow').click(); }, 100);
    """,
    # 把导出的图纸画布直接放进页面，用来肉眼检查导出版式
    "export": """
      HTMLCanvasElement.prototype.toBlob = function(cb){
        this.style.cssText='max-width:98vw;height:auto;box-shadow:0 2px 12px #0003';
        var d=document.createElement('div');
        d.style.cssText='padding:12px;background:#f0f2f5';
        d.appendChild(this);
        document.body.innerHTML='';
        document.body.appendChild(d);
        cb(null);
      };
      document.getElementById('expPng').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    """,
}

mode = sys.argv[1] if len(sys.argv) > 1 else "base"
body = MODES.get(mode, "")
dst = os.path.join(HERE, "._shot_%s.html" % mode)

with open(src, encoding="utf-8") as f:
    html = f.read()

AUTO = """
<script>
(function(){
  var W=16,H=16;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var g=c.getContext('2d'), img=g.createImageData(W,H);
  // 一个 16x16 的字母 F（左右明显不对称）
  var on=function(x,y){ return (x>=4&&x<=6&&y>=3&&y<=12)
                        || (x>=4&&x<=11&&y>=3&&y<=4)
                        || (x>=4&&x<=9&&y>=7&&y<=8); };
  for(var y=0;y<H;y++)for(var x=0;x<W;x++){
    var k=(y*W+x)*4;
    var col = on(x,y) ? [30,30,30] : [240,238,232];
    img.data[k]=col[0]; img.data[k+1]=col[1]; img.data[k+2]=col[2]; img.data[k+3]=255;
  }
  g.putImageData(img,0,0);
  loadImage(c.toDataURL('image/png'),'letter-F.png');
  setTimeout(function(){
    var side=document.getElementById('sideLen');
    side.value=32; side.dispatchEvent(new Event('change'));
    document.getElementById('cell').value=22;
    document.getElementById('cell').dispatchEvent(new Event('input'));
    document.getElementById('maxc').value=6;
    document.getElementById('maxc').dispatchEvent(new Event('input'));
    __MODE__
  }, 60);
})();
</script>
""".replace("__MODE__", body)

html = html.replace("</body>", AUTO + "</body>")
with open(dst, "w", encoding="utf-8") as f:
    f.write(html)
print(dst)
