---
title: "Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记"
date: "2026-11-01 21:30:10"
updated: "2026-11-01 21:30:10"
permalink: "2026/11/01/cc1-study-notes/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC1"]
description: "CC1 LazyMap、Transformer 与动态代理的系统整理，保留当时的实验结果和未完成事项。"
excerpt: "CC1 LazyMap、Transformer 与动态代理的系统整理，保留当时的实验结果和未完成事项。"
obsidian_source: "Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记.md"
---

> **实验环境**
> 
> - JDK：1.8.0_65
>     
> - IDE：IntelliJ IDEA
>     
> - 依赖：Commons Collections 3.2.1
>     
> - 研究对象：CC1 LazyMap + 动态代理调用链
>     
> - 参考项目：[ysoserial](https://github.com/frohoff/ysoserial)
>     
> - 注意：经典 CC1 依赖历史 JDK 行为，JDK 8u71 之后的相关修复会阻断经典路径。
>     

## 一、Commons Collections 简介

Apache Commons Collections 是对 Java 集合框架的扩展，提供额外的集合操作功能。

CC1 中涉及的主要类：

|类|作用|
|---|---|
|Transformer|对象转换接口|
|ConstantTransformer|返回指定常量|
|InvokerTransformer|通过反射调用方法|
|ChainedTransformer|串联多个 Transformer|
|LazyMap|键不存在时触发 Transformer|
|AnnotationInvocationHandler|JDK 内部注解调用处理器|
|Proxy|Java 动态代理|

核心原理：通过反序列化恢复对象时产生的方法调用，间接触发第三方集合类中的 Transformer。

---

## 二、Transformer 接口

### 2.1 接口定义

```java
public interface Transformer {
    Object transform(Object input);
}
```

- 返回值 `Object`：转换后的对象。
    
- 参数 `Object input`：当前 Transformer 接收的对象。
    

使用 `Object` 类型可以让转换器处理多种引用类型。

### 2.2 ConstantTransformer

核心源码：

```java
private final Object iConstant;

public ConstantTransformer(Object constantToReturn) {
    super();
    iConstant = constantToReturn;
}

public Object transform(Object input) {
    return iConstant;
}
```

特点：

1. 构造方法将传入的常量保存到 `iConstant` 字段。
    
2. `transform()` 不使用 `input`。
    
3. 每次调用均返回对象内部保存的 `iConstant`。
    

示例：

```java
Transformer t = new ConstantTransformer("hello");

System.out.println(t.transform("abc"));
```

输出：

```text
hello
```

**实例字段与方法参数的区别：**

- `iConstant` 是创建对象时保存的状态。
    
- `input` 是调用 `transform()` 时传入的参数。
    

不同 ConstantTransformer 实例可以保存不同的 `iConstant`。

### 2.3 InvokerTransformer

构造方法示例：

```java
Transformer t = new InvokerTransformer(
    "toUpperCase",
    new Class[]{},
    new Object[]{}
);

Object result = t.transform("hello");
```

结果：

```text
HELLO
```

核心源码逻辑：

```java
Class cls = input.getClass();

Method method = cls.getMethod(
    iMethodName,
    iParamTypes
);

return method.invoke(input, iArgs);
```

变量含义：

|字段或变量|含义|
|---|---|
|input|被调用方法所属的对象|
|iMethodName|指定的方法名|
|iParamTypes|方法形参类型数组|
|iArgs|方法实际参数数组|
|cls|输入对象对应的 Class|
|method|通过反射找到的方法|

例如：

```java
new InvokerTransformer(
    "substring",
    new Class[]{int.class},
    new Object[]{6}
);
```

当输入为 `"hello java"` 时，相当于：

```java
"hello java".substring(6);
```

返回：

```text
java
```

注意：

- `int.class` 表示方法参数类型。
    
- `new Object[]{6}` 表示实际参数。
    
- `substring()` 属于 String 类，不属于 int 类。
    

### 2.4 ChainedTransformer

核心源码：

```java
public Object transform(Object object) {
    for (int i = 0; i < iTransformers.length; i++) {
        object = iTransformers[i].transform(object);
    }

    return object;
}
```

作用：按顺序执行数组中的 Transformer。

示例：

```java
Transformer[] transformers = new Transformer[]{
    new ConstantTransformer("abcdef"),
    new InvokerTransformer(
        "substring",
        new Class[]{int.class},
        new Object[]{2}
    ),
    new InvokerTransformer(
        "toUpperCase",
        new Class[]{},
        new Object[]{}
    )
};
```

调用：

```java
Transformer chain = new ChainedTransformer(transformers);
Object result = chain.transform("hello");
```

执行过程：

```text
"hello"
   ↓
ConstantTransformer
   ↓
"abcdef"
   ↓
InvokerTransformer.substring(2)
   ↓
"cdef"
   ↓
InvokerTransformer.toUpperCase()
   ↓
"CDEF"
```

结论：

**每个 Transformer 的输出都是下一个 Transformer 的输入。**

`ChainedTransformer` 使用的是循环调用，不是递归。

---

## 三、LazyMap 的触发机制

### 3.1 LazyMap 的作用

普通 HashMap：

```java
Map map = new HashMap();
map.get("name");
```

键不存在时，返回 `null`。

LazyMap 则可以在键不存在时，通过 Transformer 自动生成值。

示例：

```java
Map innerMap = new HashMap();

Transformer transformer =
    new ConstantTransformer("Hello LazyMap");

Map lazyMap = LazyMap.decorate(
    innerMap,
    transformer
);
```

### 3.2 LazyMap.get() 源码

```java
public Object get(Object key) {

    if (map.containsKey(key) == false) {

        Object value = factory.transform(key);

        map.put(key, value);

        return value;
    }

    return map.get(key);
}
```

执行过程：

```text
lazyMap.get("name")
       ↓
map.containsKey("name")
       ↓
键不存在
       ↓
factory.transform("name")
       ↓
获得转换结果
       ↓
map.put("name", value)
       ↓
return value
```

触发条件：

- 如果键不存在，执行 Transformer 并保存生成的值。
    
- 如果键已经存在，直接返回保存的值，不再执行 Transformer。
    

注意：即使某个键对应的值是 `null`，只要该键存在，`containsKey()` 仍然为 `true`。

### 3.3 factory 与 transformer 的关系

```java
Transformer transformer =
    new ConstantTransformer("Hello LazyMap");

Map lazyMap = LazyMap.decorate(
    new HashMap(),
    transformer
);
```

`decorate()`：

```java
public static Map decorate(Map map, Transformer factory) {
    return new LazyMap(map, factory);
}
```

构造方法：

```java
protected LazyMap(Map map, Transformer factory) {
    super(map);
    this.factory = factory;
}
```

这里的 `transformer` 和 `factory` 不是两个新对象，而是两个指向同一个 Transformer 实例的引用。

`this.factory` 将该引用保存到 LazyMap 内部。

因此以后执行：

```java
factory.transform(key);
```

就能调用我们创建的 Transformer。

---

## 四、Java 动态代理

### 4.1 Proxy 与 InvocationHandler

动态代理涉及两个核心对象：

**Proxy：代理对象**

用于接收对接口方法的调用。

**InvocationHandler：调用处理器**

决定代理对象的方法被调用时，具体执行什么逻辑。

示例：

```java
InvocationHandler handler = (proxy, method, args) -> {
    System.out.println(method.getName());
    return null;
};

Map proxyMap = (Map) Proxy.newProxyInstance(
    Map.class.getClassLoader(),
    new Class[]{Map.class},
    handler
);
```

调用：

```java
proxyMap.entrySet();
```

会进入：

```java
handler.invoke(proxy, method, args);
```

其中 `method.getName()` 为：

```text
entrySet
```

### 4.2 invoke() 的参数

```text
Object invoke(
    Object proxy,
    Method method,
    Object[] args
)
```

|参数|含义|
|---|---|
|proxy|接收方法调用的代理对象|
|method|被调用的接口方法|
|args|调用方法时传入的实际参数|

例如：

```java
proxyMap.get("name");
```

对应：

```java
method.getName() = "get"
args[0] = "name"
```

而：

```java
proxyMap.entrySet();
```

对应：

```java
method.getName() = "entrySet"
args = null
```

无参代理方法的 `args` 通常为 `null`。

### 4.3 两种 invoke() 的区别

**InvocationHandler.invoke()**

处理代理对象的方法调用：

```java
handler.invoke(proxy, method, args);
```

**Method.invoke()**

通过 Java 反射执行指定方法：

```java
method.invoke(target, args);
```

两者不是同一个方法。

尤其需要注意：

`InvocationHandler.invoke()` 内部不一定必须使用反射。

例如：

```java
InvocationHandler handler = (proxy, method, args) -> {
    lazyMap.get("name");
    return new HashSet();
};
```

这里直接调用 `LazyMap.get()`，没有使用 `Method.invoke()`。

### 4.4 代理返回值类型

假设调用：

```java
proxyMap.entrySet();
```

`Map.entrySet()` 的返回类型是 `Set`。

如果 handler 返回 String，代理方法最终可能抛出 `ClassCastException`。

但如果在返回值类型检查之前，handler 已经调用了 LazyMap，那么此前产生的副作用可能已经发生。

结论：

**方法最终抛出异常，不代表之前执行的操作没有发生。**

---

## 五、AnnotationInvocationHandler

### 5.1 类的作用

JDK 8 中的内部类：

```text
sun.reflect.annotation.AnnotationInvocationHandler
```

它实现：

```text
InvocationHandler
Serializable
```

因此：

1. 可以作为动态代理的调用处理器。
    
2. 可以作为 Java 序列化对象图的一部分。
    

### 5.2 构造方法

```text
AnnotationInvocationHandler(
    Class<? extends Annotation> type,
    Map<String, Object> memberValues
) {
    this.type = type;
    this.memberValues = memberValues;
}
```

两个重要字段：

|字段|作用|
|---|---|
|type|保存注解类型|
|memberValues|保存注解成员值的 Map 引用|

### 5.3 通过反射获取构造方法

```java
Class<?> clazz = Class.forName(
    "sun.reflect.annotation.AnnotationInvocationHandler"
);

Constructor<?> constructor =
    clazz.getDeclaredConstructor(
        Class.class,
        Map.class
    );

constructor.setAccessible(true);
```

逐行解释：

**Class.forName()**

根据完整类名获取 Class 对象。

**getDeclaredConstructor()**

查找当前类声明的、形参类型为 `Class` 和 `Map` 的构造方法。

**setAccessible(true)**

请求绕过 Java 语言访问检查，以使用非公开构造方法。

它不会把原始构造方法永久改为 `public`。

### 5.4 Constructor.newInstance()

```java
InvocationHandler handlerB =
    (InvocationHandler) constructor.newInstance(
        Override.class,
        lazyMap
    );
```

这里才真正创建 Handler 实例。

对应构造参数：

```java
type = Override.class
memberValues = lazyMap
```

其中 `Override.class` 是 JDK 内置注解类型。

创建对象时只进行初始化，不会自动执行 Handler 的 `invoke()`。

---

## 六、AnnotationInvocationHandler.invoke() 源码

JDK 8u65 中反编译的变量名及含义：

|变量|含义|
|---|---|
|var1|proxy|
|var2|method|
|var3|args|
|var4|methodName|
|var5|parameterTypes|
|var6|result|

关键逻辑：

```java
String methodName = method.getName();
Class[] parameterTypes = method.getParameterTypes();

if (methodName.equals("equals")
        && parameterTypes.length == 1
        && parameterTypes[0] == Object.class) {

    return this.equalsImpl(args[0]);

} else if (parameterTypes.length != 0) {

    throw new AssertionError(
        "Too many parameters for an annotation method"
    );
}
```

随后判断：

```java
switch (methodName) {

    case "toString":
        return this.toStringImpl();

    case "hashCode":
        return this.hashCodeImpl();

    case "annotationType":
        return this.type;

    default:
        Object result =
            this.memberValues.get(methodName);
}
```

### 6.1 为什么 entrySet() 可以进入 default？

当代理对象调用：

```java
proxyMap.entrySet();
```

得到：

```text
methodName = "entrySet"
parameterTypes.length = 0
```

因此：

1. 不进入 equals 分支。
    
2. 不触发参数数量异常。
    
3. 不匹配 toString、hashCode、annotationType。
    
4. 最终进入 default。
    

执行：

```java
this.memberValues.get("entrySet");
```

### 6.2 为什么 get("name") 不可以？

如果代理对象调用：

```java
proxyMap.get("name");
```

得到：

```text
methodName = "get"
parameterTypes.length = 1
```

由于 `get(Object key)` 有一个形参，且不属于特殊处理的 `equals(Object)`，因此触发：

```java
throw new AssertionError(
    "Too many parameters for an annotation method"
);
```

不会进入 default 分支。

注意：`getParameterTypes().length` 表示方法形参数量，不是方法名的字符数。

---

## 七、AnnotationInvocationHandler.readObject()

经典 JDK 8u65 中的相关源码：

```java
private void readObject(ObjectInputStream stream)
        throws IOException, ClassNotFoundException {

    stream.defaultReadObject();

    AnnotationType annotationType =
        AnnotationType.getInstance(this.type);

    Map memberTypes = annotationType.memberTypes();

    for (Map.Entry entry : this.memberValues.entrySet()) {
        // 注解成员类型检查
    }
}
```

### 7.1 defaultReadObject()

```java
stream.defaultReadObject();
```

恢复当前对象能够通过默认序列化机制处理的字段。

重点包括：

```text
this.type
this.memberValues
```

### 7.2 AnnotationType.getInstance()

```java
AnnotationType.getInstance(this.type);
```

获取注解类型的元信息。

例如注解有哪些成员，以及成员应该是什么类型。

### 7.3 memberTypes()

```java
Map memberTypes = annotationType.memberTypes();
```

获取注解成员名称与对应类型之间的映射。

### 7.4 memberValues.entrySet()

```java
for (Map.Entry entry : this.memberValues.entrySet()) {
```

这一行是经典 CC1 的重要调用位置。

如果 `memberValues` 是普通 Map，那么只是普通集合遍历。

如果 `memberValues` 是动态代理 Map，那么调用 `entrySet()` 会进入代理对象绑定的 `InvocationHandler.invoke()`。

---

## 八、经典 CC1 LazyMap 版本的对象关系

经典 ysoserial CC1 使用两个不同的 `AnnotationInvocationHandler` 实例。

```text
Handler A
    │
    └── memberValues → proxyMap
                           │
                           └── InvocationHandler → Handler B
                                                      │
                                                      └── memberValues → LazyMap
                                                                            │
                                                                            └── factory → ChainedTransformer
```

### Handler A

作用：作为反序列化处理过程中的外层对象。

其 `memberValues` 指向代理 Map。

### Handler B

作用：作为代理 Map 的 InvocationHandler。

其 `memberValues` 指向 LazyMap。

**两个 Handler 属于相同的类，但不是同一个对象。**

当执行 Handler A 的实例方法时：

```text
this.memberValues
```

指向代理 Map。

当执行 Handler B 的实例方法时：

```text
this.memberValues
```

指向 LazyMap。

这体现了 Java 中 `this` 与实例字段的关系。

---

## 九、经典 CC1 LazyMap 调用链

完整关键路径：

```text
ObjectInputStream.readObject()
           │
           ▼
AnnotationInvocationHandler.readObject()
           │
           ▼
this.memberValues.entrySet()
           │
           ▼
Proxy Map.entrySet()
           │
           ▼
Handler B.invoke()
           │
           ▼
method.getName()
           │
           └── "entrySet"
                    │
                    ▼
this.memberValues.get("entrySet")
           │
           ▼
LazyMap.get("entrySet")
           │
           ▼
map.containsKey("entrySet")
           │
           └── false
                    │
                    ▼
factory.transform("entrySet")
           │
           ▼
ChainedTransformer.transform()
           │
           ▼
各个 Transformer 依次执行
```

### 关键原理

反序列化期间执行了一个看似正常的 `entrySet()`。

但由于实际对象是动态代理 Map，这次方法调用被转交给 Handler B。

Handler B 根据方法名称访问 LazyMap。

LazyMap 在键不存在时触发 Transformer。

**整个过程中，程序入口并没有直接调用 Transformer，而是通过对象之间的方法调用间接触发。**

---

## 十、LazyMap 的自定义反序列化

调试时还遇到了：

```java
private void readObject(ObjectInputStream in)
        throws IOException, ClassNotFoundException {

    in.defaultReadObject();

    map = (Map) in.readObject();
}
```

这是 LazyMap 自己的反序列化恢复逻辑。

原因是其父类 `AbstractMapDecorator` 中存在：

```java
protected transient Map map;
```

`transient` 字段不会通过默认字段序列化自动保存。

因此，相关自定义序列化逻辑需要负责保存及恢复底层 Map。

这里要区分：

|方法|作用|
|---|---|
|LazyMap.readObject()|恢复 LazyMap 内部状态|
|LazyMap.get()|访问键，必要时执行 Transformer|

**进入 LazyMap.readObject() 并不代表 Transformer 已经触发。**

---

## 十一、IDEA Debug 技巧

### 11.1 三种 Step

|快捷键|功能|作用|
|---|---|---|
|F7|Step Into|进入方法内部|
|F8|Step Over|执行当前行，不进入内部调用|
|Shift + F8|Step Out|执行完当前方法并返回调用者|
|F9|Resume Program|继续执行到下一个断点|

### 11.2 观察调用栈

Debug 窗口的 Frames 用于查看当前方法由谁调用。

分析反序列化时，应重点判断：

- 当前位于哪个对象的 `readObject()`。
    
- 是否经过动态代理类。
    
- 当前 Handler 是哪一个实例。
    
- 方法调用是否进入了 LazyMap。
    
- 是否真正执行 `ChainedTransformer.transform()`。
    

### 11.3 反编译变量名

IDEA 打开 JDK 的 `.class` 文件时，可能显示：

```java
Decompiled .class file
```

局部变量名可能变成 `var1`、`var2` 等。

可以尝试为 JDK 配置对应版本的 `src.zip` 源码包，以改善阅读体验。

### 11.4 调试时的常见误区

**误区一：反序列化成功等于漏洞触发成功。**

错误。正常执行完 `readObject()` 不代表 Transformer 被触发。

**误区二：进入 AnnotationInvocationHandler.invoke() 就是 CC1 成功。**

错误。JDK 正常处理注解时也会使用这个方法。

需要检查 `method.getName()` 和调用栈。

**误区三：原始 Map 没有变化就说明利用链没有执行。**

不一定。反序列化恢复的是新对象图，通常不会直接修改序列化前的原始 Map。

**误区四：不断按 F7 就一定能看到完整链条。**

不一定。反序列化存在大量内部调用，更适合使用关键位置断点和 Frames 分析。

---

## 十二、目前的实验结果与结论

已完成：

- Commons Collections Maven 环境搭建。
    
- Transformer 基础实验。
    
- InvokerTransformer 反射源码分析。
    
- ChainedTransformer 调用过程 Debug。
    
- LazyMap.get() 的触发条件分析。
    
- Java 动态代理原理学习。
    
- AnnotationInvocationHandler.readObject() 源码阅读。
    
- AnnotationInvocationHandler.invoke() 源码阅读。
    
- JDK 8u65 环境配置。
    

尚未完成：

- 在真实 CC1 对象图反序列化过程中，明确捕获到 `ChainedTransformer.transform()` 的调用栈。
    
- 独立编写完整无害 PoC。
    
- TransformedMap 版本的源码分析和实验。
    

因此，目前应该将学习状态定义为：

**已理解经典 CC1 LazyMap 版本的主要调用原理，但尚未完成完整链条的动态验证。**

---

## 十三、下一步：TransformedMap 版本 CC1

参考文章：

[Java 反序列化 Commons-Collections 篇01—CC1 链](https://drun1baby.top/2022/06/06/Java%E5%8F%8D%E5%BA%8F%E5%88%97%E5%8C%96Commons-Collections%E7%AF%8701-CC1%E9%93%BE/)

下一阶段采用逆向追踪方式：

```java
InvokerTransformer.transform()
           ↑
ChainedTransformer.transform()
           ↑
TransformedMap.checkSetValue()
           ↑
Map.Entry.setValue()
           ↑
AnnotationInvocationHandler.readObject()
```

主要研究：

1. `TransformedMap` 与 `LazyMap` 的区别。
    
2. `checkSetValue()` 为什么会调用 Transformer。
    
3. `Map.Entry.setValue()` 如何触发值转换。
    
4. `AnnotationInvocationHandler.readObject()` 中哪些条件会导致 `setValue()` 被执行。
    
5. 如何从源码独立构建对象关系，并使用无害操作验证反序列化调用路径。
    
6. 通过 Debug 验证调用栈，解释每个方法被调用的原因。
    

**最终目标：能够不依赖现成 EXP，独立分析触发路径，并编写可验证原理的本地无害 PoC。**

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/) · [CC5 学习笔记](/2026/11/13/cc5-study/)
