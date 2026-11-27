# Contraste do texto sobre a decoração de fundo do mobile (Style Guide 2.3), no pior caso: as três
# ondas cobrindo o mesmo ponto, linha a linha, na zona do topo (240px). Uso:
#   python3 scripts/deco-contrast.py
# Tokens: src/theme.ts. Escuro: decoAlpha 0.22, sem nenhuma faixa abaixo de 4,5:1. Claro: sem
# decoração, porque o `muted` já está em 4,63:1 e só 0,03 de intensidade mantém AA (invisível).
# Se mudar cor, onda ou fade, atualize os valores abaixo e rode de novo.
import sys
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]
def lin(c): c/=255; return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def lum(c): r,g,b=[lin(x) for x in c]; return .2126*r+.7152*g+.0722*b
def cr(a,b): la,lb=lum(a),lum(b); return (max(la,lb)+.05)/(min(la,lb)+.05)
def over(base,top,a): return [base[i]*(1-a)+top[i]*a for i in range(3)]
LAYERS=[(1.0,120,70),(0.7,150,90),(0.45,90,60)]   # fator de opacidade, baseline, amplitude (Q => pico = A/2)
def grad(yv,base,A):
    top=base-A/2; return max(0,1-(yv-top)/(300-top)) if yv>=top else None
def mask(frac, kind):
    # frac = distância da borda de origem / altura. side: opaco até 55% e some até 100%. top: 0% opaco, some em 80%.
    if kind=='side': return 1 if frac<=.45 else max(0,(1-frac)/.55)   # frac contado a partir da base
    return max(0,1-frac/.8)
def worst(theme,kind,H,alpha,bg,deco,texts):
    out=[]
    for px in range(0,H,10):                # px = distância da borda de origem (base na lateral, topo no conteúdo)
        frac=px/H; yv=300-frac*300           # coordenada no viewBox (0 = topo do desenho, 300 = base)
        m=mask(frac,kind); c=rgb(bg)
        for f,base,A in LAYERS:
            g=grad(yv,base,A)
            if g is None: continue
            c=over(c,deco,alpha*f*g*m)
        out.append((px,{k:cr(rgb(v),c) for k,v in texts.items()}))
    return out

THEMES = {
    "claro": dict(deco=(8, 122, 85), bg="#F2F6F4", texts={"foreground": "#14231E", "bodyText": "#354A42", "muted": "#60736B"}),
    "escuro": dict(deco=(85, 214, 164), bg="#0C1714", texts={"foreground": "#EDF6F2", "bodyText": "#D0DFD8", "muted": "#A6B9B0"}),
}
SHIPPED = {"escuro": 0.22}  # claro não desenha decoração
for name, t in THEMES.items():
    base = cr(rgb(t["texts"]["muted"]), rgb(t["bg"]))
    alphas = [SHIPPED[name]] if name in SHIPPED else [0.03, 0.04]
    for a in alphas:
        rows = worst(name, "top", 240, a, t["bg"], t["deco"], t["texts"])
        fail = {k: [px for px, r in rows if r[k] < 4.5] for k in t["texts"]}
        d = lambda l: (f"{min(l)}-{max(l)}px" if l else "nenhuma")
        print(f"{name:6} alpha {a:.2f} (muted sem decoração {base:.2f}:1) | abaixo de 4,5:1: foreground {d(fail['foreground'])} · bodyText {d(fail['bodyText'])} · muted {d(fail['muted'])}")
