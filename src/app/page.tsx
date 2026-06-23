"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { Send, ShoppingBag, Sparkles, Truck, Package, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import ReactMarkdown from 'react-markdown';

export default function ChatPage() {
  const [language, setLanguage] = useState('English');
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [officialCities, setOfficialCities] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const { messages, sendMessage, status, error } = useChat();

  useEffect(() => {
    fetch('/api/cities')
      .then(res => res.json())
      .then(data => {
        const cityNames = Array.isArray(data.cities)
          ? data.cities.map((c: any) => c.name || c.city_name || c).filter(Boolean)
          : [];
        setOfficialCities(cityNames);
      })
      .catch(err => console.error("Failed to load cities", err));
  }, []);

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
                  {m.role === 'assistant' && textToRender.toLowerCase().includes('recipient') ? (
                    /* If it's NOT the last message anymore, just show a clean summary in the history */
                    m.id !== messages[messages.length - 1].id && (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.8 }}>
                        Requested order details...
                      </div>
                    )
                  ) : (
                    /* Otherwise, render normal text */
                    <ReactMarkdown>{textToRender}</ReactMarkdown>
                  )}
                  {m.role === 'assistant' && textToRender.toLowerCase().includes('city') && textToRender.toLowerCase().includes('date') && m.id === messages[messages.length - 1].id && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Confirm Delivery Details</h4>
                      <div className={styles.deliveryForm}>
                        <input
                          list="sri-lanka-cities"
                          className={styles.input}
                          placeholder="Type or select city (e.g., Colombo)"
                          value={selectedCity}
                          onChange={(e) => setSelectedCity(e.target.value)}
                        />
                        <datalist id="sri-lanka-cities">
                          {officialCities.map(city => (
                            <option key={city} value={city} />
                          ))}
                        </datalist>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          className={styles.input}
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        <button
                          className={`${styles.actionButton} ${styles.primary}`}
                          onClick={() => sendMessage({ text: `[ACTION: CHECK_DELIVERY] City: ${selectedCity} | Date: ${selectedDate}` }, { body: { language } })}
                        >
                          Check Availability
                        </button>
                      </div>
                    </div>
                  )}
                  {m.role === 'assistant' && textToRender.toLowerCase().includes('recipient') && m.id === messages[messages.length - 1].id && (
                    <div className={styles.deliveryForm}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--text)' }}>Finalize Order Details</h4>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input className={styles.input} placeholder="Recipient Name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                        <input className={styles.input} placeholder="Recipient Phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                      </div>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        <input className={styles.input} placeholder="Sender Name" value={senderName} onChange={(e) => setSenderName(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                        <input className={styles.input} placeholder="Sender Phone" value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                      </div>

                      <textarea 
                        className={styles.input} 
                        placeholder="Gift Message (Optional)" 
                        value={giftMessage} 
                        onChange={(e) => setGiftMessage(e.target.value)} 
                        style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                      />

                      <button
                        className={`${styles.actionButton} ${styles.primary}`}
                        disabled={status === 'submitted' || status === 'streaming'}
                        onClick={() => sendMessage({ text: `[ACTION: SUBMIT_ORDER_DETAILS] Recipient: ${recipientName} (${recipientPhone}) | Sender: ${senderName} (${senderPhone}) | Msg: ${giftMessage || 'None'}` }, { body: { language } })}
                        style={{ marginTop: '4px' }}
                      >
                        {status === 'submitted' || status === 'streaming' ? 'Generating Secure Link...' : 'Generate Checkout Link'}
                      </button>
                    </div>
                  )}
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
                          {Array.isArray(result?.results) ? result.results.map((product: any, index: number) => (
                            <div key={`product-${toolInvocation.toolCallId}-${index}`} className={styles.productCard} style={{ animationDelay: `${index * 75}ms` }}>
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
                                <a href={product.url} target="_blank" rel="noreferrer" className={`${styles.actionButton}`} style={{ textAlign: 'center', textDecoration: 'none', display: 'block', marginBottom: '8px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                  View Details
                                </a>
                                <button
                                  className={`${styles.actionButton} ${styles.primary}`}
                                  style={{ width: '100%', cursor: 'pointer' }}
                                  onClick={() => {
                                    const targetId = product.id || product.product_id || product.item_id || product.sku;
                                    sendMessage({ text: `[ACTION: SELECT_PRODUCT] Name: ${product.name} | ID: ${targetId}` }, { body: { language } });
                                  }}
                                >
                                  Select This Item
                                </button>
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
                    if (result?.error) {
                      return (
                        <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                          <div style={{ color: '#ff3333', padding: '1rem', border: '1px solid #ff3333', borderRadius: '8px', background: 'rgba(255, 51, 51, 0.1)' }}>
                            ❌ Checkout failed: {result.details || result.message || "Please check server logs."}
                          </div>
                        </div>
                      );
                    }

                    const link = result?.pay_link || result?.checkout_url || result?.url || result?.payment_link;
                    if (link) {
                      return (
                        <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                          <div className={styles.checkoutCard}>
                            <h3>Order Created Successfully! 🎉</h3>
                            <p>Your order #{result?.order_number || result?.order_id || 'is pending'} is ready for payment.</p>
                            <a href={link} target="_blank" rel="noopener noreferrer" className={styles.payLink}>
                              Complete Order on Kapruka
                            </a>
                          </div>
                        </div>
                      );
                    }

                    if (toolInvocation.state === 'result') {
                      return (
                        <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                          <div style={{ color: '#ffaa00', padding: '1rem', border: '1px solid #ffaa00', borderRadius: '8px', background: 'rgba(255, 170, 0, 0.1)', overflowWrap: 'break-word' }}>
                            ⚠️ Unexpected checkout response: {JSON.stringify(result)}
                          </div>
                        </div>
                      );
                    }
                  }

                  if (toolName === "kapruka_check_delivery") {
                    if (result?.error) {
                      return (
                        <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                          <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <p style={{ color: 'var(--text)', marginBottom: '16px', lineHeight: '1.5' }}>
                              Oops! I couldn't find <strong>{toolInvocation.args?.city}</strong> in Kapruka's delivery database. They require exact zone names (for example, "Colombo 01" instead of "Colombo 1"). <br/><br/>Could you please try selecting your city directly from the dropdown list below?
                            </p>
                            <div className={styles.deliveryForm}>
                              <input
                                list="sri-lanka-cities"
                                className={styles.input}
                                placeholder="Type or select city (e.g., Colombo 01)"
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                              />
                              <datalist id="sri-lanka-cities">
                                {officialCities.map(city => (
                                  <option key={city} value={city} />
                                ))}
                              </datalist>
                              <input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                className={styles.input}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                              />
                              <button
                                className={`${styles.actionButton} ${styles.primary}`}
                                onClick={() => sendMessage({ text: `[ACTION: CHECK_DELIVERY] City: ${selectedCity} | Date: ${selectedDate}` }, { body: { language } })}
                              >
                                Check Availability Again
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                        <div className={styles.deliveryCard}>
                          <div className={styles.deliveryIcon}>
                            <Truck size={24} />
                          </div>
                          <div className={styles.deliveryDetails}>
                            <h4>Delivery Available</h4>
                            <p>City: {result?.city || toolInvocation.args?.city || 'Confirmed'}</p>
                            <p>Rate: LKR {result?.shipping_fee || result?.rate || result?.delivery_charge || result?.data?.shipping_fee || '...'}</p>
                          </div>
                        </div>
                        <button
                          className={`${styles.actionButton} ${styles.primary}`}
                          style={{ width: '100%', marginTop: '12px' }}
                          onClick={() => sendMessage({ text: `[ACTION: PROCEED_TO_CHECKOUT] Delivery confirmed.` }, { body: { language } })}
                        >
                          Proceed to Order Details
                        </button>
                      </div>
                    );
                  }

                  if (toolName === "kapruka_get_product") {
                    // If product details JSON
                    if (result?.id) {
                      return (
                        <div key={toolInvocation.toolCallId} className={styles.toolInvocation}>
                          <div className={styles.deliveryCard} style={{ flexDirection: 'column' }}>
                            {result.images?.[0] && <img src={result.images[0]} style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', alignSelf: 'center' }} alt={result.name} />}
                            <h4>{result.name}</h4>
                            <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{result.price?.currency} {result.price?.amount}</p>
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
                        <div className={styles.carousel}>
                          {[1, 2, 3].map((i) => (
                            <div key={i} className={styles.skeletonCard} style={{ animationDelay: `${i * 100}ms` }}>
                              <div className={styles.skeletonImage}></div>
                              <div className={styles.skeletonInfo}>
                                <div className={`${styles.skeletonText} ${styles.title}`}></div>
                                <div className={styles.skeletonText}></div>
                                <div className={`${styles.skeletonText} ${styles.price}`}></div>
                                <div className={`${styles.skeletonText} ${styles.button}`}></div>
                              </div>
                            </div>
                          ))}
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
          );
        })}

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