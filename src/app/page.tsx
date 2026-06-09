"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { Send, ShoppingBag, Sparkles, Truck, Package, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
  const [language, setLanguage] = useState('English');
  const { messages, sendMessage, status, error } = useChat();

  useEffect(() => {
    const savedLanguage = localStorage.getItem('chatLanguage');
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);
  
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chatAreaRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    resizeObserver.observe(chatAreaRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status === 'submitted' || status === 'streaming') return;
    sendMessage({ text: inputValue }, { body: { language } });
    setInputValue("");
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <ShoppingBag size={24} color="var(--primary)" />
          Kapruka<span>AI</span>
        </div>
        <select 
          className={styles.languageSelect}
          value={language} 
          onChange={(e) => {
            const newLang = e.target.value;
            localStorage.setItem('chatLanguage', newLang);
            window.location.reload();
          }}
        >
          <option value="English">English</option>
          <option value="Sinhala">Sinhala</option>
          <option value="Tanglish">Tanglish</option>
        </select>
      </header>

      <main className={styles.chatArea} ref={chatAreaRef}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '10vh', color: 'var(--text-muted)' }}>
            <Sparkles size={48} style={{ marginBottom: '1rem', color: 'var(--primary)', opacity: 0.8 }} />
            <h1 style={{ color: 'white', marginBottom: '0.5rem' }}>Welcome to Kapruka AI</h1>
            <p>I can help you find products, check delivery, and create orders.</p>
            <p>Try saying: &quot;Find me a chocolate cake&quot;</p>
          </div>
        )}

        {messages.map((m: UIMessage) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textToRender = (m.parts?.find((p: any) => p.type === 'text') as any)?.text || '';
          
          return (
            <div key={m.id} className={`${styles.messageWrapper} ${m.role === 'user' ? styles.messageUser : styles.messageAssistant}`}>
              {typeof textToRender === 'string' && textToRender.trim() && (
                <div className={styles.messageContent}>
                  <ReactMarkdown>{textToRender}</ReactMarkdown>
                </div>
              )}
            {/* Handle Tool Invocations for Rich UI */}
            {m.parts?.filter((p: any) => p.type.startsWith('tool-') || p.type === 'dynamic-tool').map((toolInvocation: any) => {
              // Extract the toolName correctly, whether it's embedded in the type or in toolName field
              const toolName = toolInvocation.toolName || (toolInvocation.type.startsWith('tool-') ? toolInvocation.type.replace('tool-', '') : '');
              
              if (toolInvocation.state === "result" || toolInvocation.state === "output-available") {
                const result = toolInvocation.result || toolInvocation.output;

                if (toolName === "kapruka_search_products") {
                  if (result?.error) {
                    return (
                      <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                        <div style={{ padding: '1rem', color: 'var(--error)', background: 'var(--surface)', border: '1px solid var(--error)', borderRadius: '8px' }}>
                          ⚠️ {result.error}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                      <div className={styles.carousel}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {Array.isArray(result?.results) ? result.results.map((product: any) => (
                          <div key={product.id} className={styles.productCard}>
                            <div className={styles.productImage}>
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name} 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/260x180/ffebe0/ff6a00?text=Kapruka';
                                  }}
                                />
                              ) : (
                                <Package size={48} color="var(--border)" />
                              )}
                            </div>
                            <div className={styles.productInfo}>
                              <div className={styles.productName} title={product.name}>{product.name}</div>
                              <div className={`${styles.productStock} ${product.in_stock ? styles.inStock : styles.outStock}`}>
                                {product.in_stock ? "In Stock" : "Out of Stock"}
                              </div>
                              <div className={styles.productPrice}>
                                {product.price?.currency} {product.price?.amount != null ? product.price.amount.toLocaleString() : "N/A"}
                              </div>
                              <a href={product.url} target="_blank" rel="noreferrer" className={`${styles.actionButton} ${styles.primary}`} style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                                View Details
                              </a>
                            </div>
                          </div>
                        )) : typeof result === 'string' ? (
                          <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>{result}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                }

                if (toolName === "kapruka_create_order") {
                  if (result?.pay_link) {
                    return (
                      <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                        <div className={styles.checkoutCard}>
                          <h3>Order Created Successfully! 🎉</h3>
                          <p>Your order #{result.order_number} is ready for payment.</p>
                          <a href={result.pay_link} target="_blank" rel="noreferrer" className={styles.payLink}>
                            Complete Payment
                          </a>
                        </div>
                      </div>
                    );
                  }
                }

                if (toolName === "kapruka_check_delivery") {
                  return (
                    <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                      <div className={styles.deliveryCard}>
                        <div className={styles.deliveryIcon}>
                          <Truck size={24} />
                        </div>
                        <div className={styles.deliveryDetails}>
                          <h4>Delivery Available</h4>
                          <p>City: {result?.city}</p>
                          <p>Rate: LKR {result?.delivery_charge}</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (toolName === "kapruka_get_product") {
                  // If product details JSON
                  if (result?.id) {
                     return (
                      <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                        <div className={styles.deliveryCard} style={{flexDirection: 'column'}}>
                           {result.images?.[0] && <img src={result.images[0]} style={{maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', alignSelf: 'center'}} alt={result.name} />}
                           <h4>{result.name}</h4>
                           <p style={{color: 'var(--primary)', fontWeight: 'bold'}}>{result.price?.currency} {result.price?.amount}</p>
                           <p>{result.summary || result.description}</p>
                           <a href={result.url} target="_blank" rel="noreferrer" className={`${styles.actionButton} ${styles.primary}`} style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}>
                              View on Kapruka
                           </a>
                        </div>
                      </div>
                     );
                  }
                }
              } else if (toolInvocation.state === "call" || toolInvocation.state === "partial-call" || toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available") {
                 const isSearching = toolName === 'kapruka_search_products';
                 return (
                   <div key={toolInvocation.toolCallId} className={`${styles.messageWrapper} ${styles.messageAssistant}`}>
                      {isSearching ? (
                        <div className={styles.searchAnimation}>
                          <div className={styles.searchIconWrapper}>
                            <Search size={20} />
                          </div>
                          <span>Scanning catalog for the perfect items...</span>
                        </div>
                      ) : (
                        <div className={styles.messageContent} style={{ opacity: 0.7, fontStyle: 'italic', display: 'flex', gap: '8px', alignItems: 'center' }}>
                           <Search size={16} />
                           {toolName === 'kapruka_check_delivery' ? 'Checking delivery...' :
                            toolName === 'kapruka_create_order' ? 'Creating order...' : 
                            'Processing...'}
                        </div>
                      )}
                   </div>
                 )
              }
              return null;
            })}
          </div>
        );})}

        {(status === 'submitted' || status === 'streaming') && messages[messages.length - 1]?.role === "user" && (
          <div className={`${styles.messageWrapper} ${styles.messageAssistant}`}>
            <div className={styles.messageContent}>
              <div className={styles.loadingIndicator}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {error && (
        <div style={{ color: 'var(--error)', textAlign: 'center', padding: '0.5rem', fontSize: '0.9rem' }}>
          Error: {error.message || 'Failed to fetch response. Did you forget to add your GOOGLE_GENERATIVE_AI_API_KEY to .env.local?'}
        </div>
      )}

      <div className={styles.inputArea}>
        <form onSubmit={handleFormSubmit} className={styles.form}>
          <input
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="What are you looking for?"
            disabled={status === 'submitted' || status === 'streaming'}
          />
          <button type="submit" className={styles.sendButton} disabled={(status === 'submitted' || status === 'streaming') || !inputValue.trim()}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
