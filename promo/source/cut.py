import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
im=Image.open(sys.argv[1]).convert('RGB'); a=np.asarray(im).astype(int)
mn=a.min(axis=2); sat=a.max(axis=2)-mn
bgish=(mn>=int(sys.argv[3]))&(sat<12)
lab,n=ndimage.label(bgish)
edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
sz=ndimage.sum(bgish,lab,range(1,n+1))
big={i+1 for i,v in enumerate(sz) if v>1000}
bg=np.isin(lab,list(edge|big))
fg=~bg
fg=ndimage.binary_opening(fg,iterations=1)
lab2,n2=ndimage.label(fg); sizes=ndimage.sum(fg,lab2,range(1,n2+1)); fg=lab2==(np.argmax(sizes)+1)
fg=ndimage.binary_erosion(fg,iterations=1)
alpha=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
im=im.resize((im.width*3,im.height*3),Image.LANCZOS).filter(ImageFilter.UnsharpMask(2,60,2)); alpha=alpha.resize(im.size,Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.5))
out=im.convert('RGBA'); out.putalpha(alpha)
bb=out.getbbox(); out=out.crop(bb); out.save(sys.argv[2]); print(bb,out.size)
prev=Image.new('RGBA',out.size,(20,30,70,255)); prev.alpha_composite(out); prev.convert('RGB').save(sys.argv[2]+'.prev.jpg')
