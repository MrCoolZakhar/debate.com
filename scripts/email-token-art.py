from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
S=4  # supersample
def coin(D=360):
    W=D*S; img=Image.new('RGBA',(W,W),(0,0,0,0))
    # drop shadow
    sh=Image.new('RGBA',(W,W),(0,0,0,0)); d=ImageDraw.Draw(sh)
    pad=int(W*0.06); d.ellipse([pad,pad+int(W*0.04),W-pad,W-pad+int(W*0.04)],fill=(27,56,40,110))
    sh=sh.filter(ImageFilter.GaussianBlur(W*0.03)); img.alpha_composite(sh)
    # rim (edge thickness, darker gold)
    r0=pad; 
    rim=Image.new('RGBA',(W,W),(0,0,0,0)); dr=ImageDraw.Draw(rim)
    dr.ellipse([r0,r0+int(W*0.025),W-r0,W-r0+int(W*0.025)],fill=(150,110,30,255))
    img.alpha_composite(rim)
    # face radial gradient
    face=Image.new('RGBA',(W,W),(0,0,0,0)); px=face.load()
    cx,cy=W*0.42,W*0.36; R=(W-2*r0)/2; Cx,Cy=W/2,W/2
    top=(255,238,170); mid=(234,196,92); low=(186,140,40)
    for y in range(W):
        for x in range(0,W):
            if (x-Cx)**2+(y-Cy)**2<=R*R:
                t=min(1,math.hypot(x-cx,y-cy)/(R*1.55))
                if t<0.5: a=t/0.5; c=[top[i]+(mid[i]-top[i])*a for i in range(3)]
                else: a=(t-0.5)/0.5; c=[mid[i]+(low[i]-mid[i])*a for i in range(3)]
                px[x,y]=(int(c[0]),int(c[1]),int(c[2]),255)
    img.alpha_composite(face)
    d=ImageDraw.Draw(img)
    # inner rings
    for k,(w,col) in enumerate([(0.10,(160,118,32,255)),(0.115,(255,240,190,200))]):
        m=int(W*w); d.ellipse([m,m,W-m,W-m],outline=col,width=int(W*0.008))
    # beading dots
    Rb=R*0.86
    for i in range(48):
        a=2*math.pi*i/48; x=Cx+Rb*math.cos(a); y=Cy+Rb*math.sin(a); rr=W*0.006
        d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=(170,126,36,255))
    # emblem: gavel mark tinted forest, embossed
    mk=Image.open('/Users/peterzakhar/debate.com/public/gavel-mark.png').convert('RGBA')
    size=int(W*0.46); mk=mk.resize((size,size),Image.LANCZOS)
    alpha=mk.split()[3]
    ox=(W-size)//2; oy=(W-size)//2
    hl=Image.new('RGBA',(size,size),(255,246,210,170)); hl.putalpha(alpha.point(lambda v:int(v*0.65)))
    img.alpha_composite(hl,(ox-int(W*0.004),oy-int(W*0.004)))
    fg=Image.new('RGBA',(size,size),(27,56,40,255)); fg.putalpha(alpha)
    img.alpha_composite(fg,(ox,oy))
    # glossy highlight arc
    gl=Image.new('RGBA',(W,W),(0,0,0,0)); dg=ImageDraw.Draw(gl)
    dg.ellipse([r0+W*0.08,r0+W*0.05,W-r0-W*0.25,W*0.52],fill=(255,255,255,55))
    gl=gl.filter(ImageFilter.GaussianBlur(W*0.03))
    mask=Image.new('L',(W,W),0); ImageDraw.Draw(mask).ellipse([r0,r0,W-r0,W-r0],fill=255)
    gl.putalpha(ImageChops.multiply(gl.split()[3],mask))
    img.alpha_composite(gl)
    return img.resize((D,D),Image.LANCZOS)
c=coin(360); c.save('token.png')
# two stacked coins
W2,H2=560,400; pair=Image.new('RGBA',(W2,H2),(0,0,0,0))
a=coin(300); b=coin(300)
pair.alpha_composite(a.rotate(-8,resample=Image.BICUBIC),(40,70)); pair.alpha_composite(b.rotate(6,resample=Image.BICUBIC),(220,40))
pair.save('tokens-2.png')
print('ok')
