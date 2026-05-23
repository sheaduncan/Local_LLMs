// Course content for the Local LLM training program.
// Block types: p (paragraph), h (subheading), list, callout, code.
// Quiz: {q, a:[options], c:correctIndex, e:explanation}.

window.COURSE = {
  meta: {
    title: "Local LLMs: A Practical Course",
    subtitle: "Tokens in, probabilities out, one next token at a time.",
    updated: "2026-05-23"
  },
  modules: [
    {
      id: "m1",
      title: "The Inference Loop",
      summary: "How an LLM actually produces an answer: tokens, Transformers, attention, KV cache, prefill, decode, and the decoding policy.",
      lessons: [
        {
          id: "m1l1",
          title: "What an LLM Actually Does",
          blocks: [
            { t: "p", x: "Running a language model to produce text is called inference. For a decoder-only LLM — the architecture behind every local chat model covered in this course — inference is the same short loop, repeated once per generated token." },
            { t: "p", x: "The loop exists because the model is autoregressive: each prediction depends on every prior token in the sequence. Token N must be present before the model can compute the prediction for token N+1. That dependency forbids producing an entire answer in a single pass, and it is the structural reason local generation speed is reported in tokens per second rather than queries per second." },
            { t: "list", items: [
              "Convert the input text into tokens.",
              "Feed the current sequence into the model.",
              "Compute scores for every possible next token.",
              "Choose one token using a decoding policy.",
              "Append that token to the sequence.",
              "Repeat until the model emits a stop token, the runtime halts decoding, or a token limit is reached."
            ]},
            { t: "visual", id: "inferenceLoop" },
            { t: "p", x: "The streaming \"typing\" effect visible in a chat interface is this loop running in real time. Each rendered token is one full iteration. A response that streams smoothly at 30 tokens per second means the loop is completing roughly every 33 milliseconds; a response that types slowly means the loop itself is the bottleneck." },
            { t: "widget", id: "inferenceTimePredictor" },
            { t: "h", x: "The math behind one iteration" },
            { t: "p", x: "Treated formally, a decoder-only LLM is a learned function whose inputs are the model's weights and the current sequence, and whose output is a probability distribution over the next token. The formal notation is worth absorbing now because it recurs throughout the rest of the course — the symbols below appear in lessons on attention, the KV cache, and decoding." },
            { t: "code", x: "f(theta, sequence) -> probability distribution over next_token" },
            { t: "expand", x: "Un-pack — the five symbols that recur throughout the course", blocks: [
              { t: "defs", items: [
                { term: "theta (θ)",
                  def: "The complete set of learned numerical values that define the model — billions of parameters fixed at the end of training. Theta is the standard mathematical notation for these values when treating the network as a function. At inference time the values do not change; they are loaded from the model file on disk." },
                { term: "sequence",
                  def: "The full token stream the model attends to at the current step: the original prompt plus every token already generated. The sequence grows by exactly one token on each iteration of the loop." },
                { term: "logits",
                  def: "The raw numerical scores the model produces for every token in its vocabulary at a given step. Logits can be any real number — positive or negative — and have not yet been normalized into probabilities." },
                { term: "softmax",
                  def: "The mathematical function that converts logits into a valid probability distribution: each token receives a value between 0 and 1, and the values across the vocabulary sum to exactly 1." },
                { term: "decoding",
                  def: "The policy that selects one token from the probability distribution — taking the highest-probability candidate (greedy), sampling stochastically, restricting selection to the top-k or top-p candidates, or some combination. Covered in detail in a later lesson." }
              ]}
            ]},
            { t: "callout", x: "Each lesson in this module unpacks one piece of the loop above. Tokens (the unit consumed in step 1) are detailed in the next lesson. The model itself — the box in step 2 — is opened in the lessons on Transformers and attention. The working memory that lets the loop avoid recomputing the entire sequence on every step is the subject of the KV cache lesson. The two distinct performance regimes the loop spends time in — prefill and decode — get their own lesson. And the choice made in step 4 is covered in the lesson on decoding." },
            { t: "callout", x: "A practical prediction the reader should now be able to make: a 600-token response produced by a model that decodes at 30 tokens per second will take roughly 20 seconds to complete, regardless of how quickly the prompt itself was processed. The loop runs once per output token, so output length is a linear cost in time." }
          ],
          quiz: [
            { q: "How does a decoder-only LLM produce an answer?",
              a: ["It generates the whole answer in a single forward pass",
                  "It generates one token at a time, appending each to the sequence",
                  "It retrieves the closest answer from its training data",
                  "It plans the full response, then fills in words"],
              c: 1,
              e: "Inference is a loop: compute next-token scores, pick one, append it, repeat. Each new token becomes part of the input for the next step." },
            { q: "In f(theta, sequence), what does theta refer to?",
              a: ["The model's weights", "The user's prompt", "The decoding temperature", "The KV cache"],
              c: 0,
              e: "theta is the model weights — the learned parameters. The sequence is the prompt plus generated tokens so far." },
            { q: "You paste a 10,000-token document and wait several seconds before the first word appears. Which phase is responsible?",
              a: ["Decode", "Prefill", "Tokenization", "Softmax"],
              c: 1,
              e: "The pause before the first token is prefill — the model processing the whole prompt. Slow streaming after that would be decode." },
            { q: "What are logits?",
              a: ["The final selected tokens",
                  "Normalized probabilities after softmax",
                  "Raw next-token scores before softmax",
                  "The model's weights"],
              c: 2,
              e: "Logits are raw scores. Softmax normalizes them into probabilities, and decoding turns probabilities into one selected token." }
          ]
        },
        {
          id: "m1l2",
          title: "Tokens",
          blocks: [
            { t: "p", x: "Tokens are the unit a language model operates on. The model never sees raw text directly — it sees a sequence of integer IDs, each of which corresponds to a small chunk of text in the model's vocabulary. Every step of the inference loop introduced in the previous lesson processes tokens and produces a score for the next token." },
            { t: "p", x: "Modern LLMs use sub-word tokenization rather than splitting on words or characters. Word-level tokenization fails on rare and unseen words and requires an impossibly large vocabulary to cover every form of every word; character-level tokenization produces sequences so long that compute and memory costs become impractical. Sub-word methods such as BPE (Byte Pair Encoding) and SentencePiece compromise between the two: they learn common multi-character sequences during training and treat those sequences as tokens, which keeps common words intact while still handling unusual or unseen text gracefully." },
            { t: "list", items: [
              "A whole word, like 'hello'.",
              "A word fragment, like 'inter' or 'national'.",
              "A punctuation mark.",
              "A whitespace-prefixed string.",
              "A special control marker such as <|user|>, <|assistant|>, BOS (beginning-of-sequence), or EOS (end-of-sequence)."
            ]},
            { t: "p", x: "The special control markers in the last item are not incidental — they are the mechanism that makes chat templates work. The model distinguishes a system message from a user message from an assistant turn by emitting and recognizing these specific markers. The Model Package module covers chat templates in detail." },
            { t: "p", x: "The same text produces different token counts in different tokenizers. A 4,000-word document might tokenize to 5,000 tokens with one model family's tokenizer and 7,500 with another, because the two tokenizers learned different sub-word vocabularies during their respective training runs. The interactive demo below illustrates how a single input string splits into tokens — try editing the text to see the count change." },
            { t: "widget", id: "tokenizer" },
            { t: "p", x: "Vocabulary size — the total number of distinct tokens a tokenizer recognizes — is a structural choice with consequences at both ends of the network. A larger vocabulary lets each token represent a longer span of text, reducing the token count of any given document and the prefill cost of processing it. The price is paid at the input embedding layer and the output projection layer, both of which scale with vocabulary size: a 200,000-token vocabulary requires noticeably more parameters at the edges of the network than a 100,000-token vocabulary. This is one reason tokens-per-second values are not directly comparable across model families." },
            { t: "expand", x: "Un-pack — tokenizer, BPE, SentencePiece, vocabulary, embedding, byte fallback", blocks: [
              { t: "defs", items: [
                { term: "tokenizer", def: "The program that converts input text into a sequence of integer IDs the model can process, and converts generated IDs back into text. Every model family ships with its own tokenizer." },
                { term: "BPE", def: "Byte Pair Encoding. A tokenization method that begins with single characters and learns common multi-character sequences (\"th\", \"in\", \"tion\") during training, treating those learned sequences as their own tokens. Used by GPT, Llama, Qwen, Mistral, and most modern models." },
                { term: "SentencePiece", def: "A tokenization method developed at Google. Operates directly on the byte stream rather than relying on word boundaries, which works well across languages and writing systems. Used by Gemma, T5, and various multilingual models." },
                { term: "vocabulary", def: "The full set of tokens a tokenizer recognizes. A typical modern LLM has 100,000–200,000 entries; each entry is a chunk of text the model can directly emit." },
                { term: "vocab size", def: "The number of entries in the vocabulary. A larger vocabulary lets each token represent a longer span of text, so a given document tokenizes to fewer tokens — at the cost of more parameters in the embedding and output-projection layers." },
                { term: "embedding", def: "A lookup table that maps a token ID to a vector of numbers. That vector is the representation the Transformer operates on (covered in detail in the Transformers lesson). A larger vocabulary requires a correspondingly larger lookup table." },
                { term: "byte fallback", def: "A safety mechanism in many tokenizers: when input text contains a character or sequence the tokenizer was not trained on, it falls back to representing those bytes individually. This prevents the tokenizer from failing on unfamiliar input, at the cost of producing longer token sequences for that input." }
              ]}
            ]},
            { t: "h", x: "Why tokens matter" },
            { t: "list", items: [
              "Context fit: every model has a maximum context length, and that length is measured in tokens.",
              "Memory cost: the KV cache scales linearly with token count (covered in the KV cache lesson).",
              "Latency: prefill cost grows with input token count; decode runs the loop once per output token.",
              "Multilingual and code efficiency: tokenizers compress some languages and character sets better than others — the same idea expressed in different languages may use very different token counts.",
              "Chat structure: the special control tokens are how the model parses the boundaries of a conversation."
            ]},
            { t: "p", x: "A model's context window is the maximum number of tokens it can attend to in a single inference call. As of 2026, common local models range from 8K and 32K up to 128K, 256K, and in some cases 1M tokens. The upper end is impressive on the spec sheet but expensive in practice: longer context means a proportionally larger KV cache, slower prefill, and often degraded coherence at the far end of the window." },
            { t: "callout", x: "Supported context length is not equivalent to context length that runs cheaply, runs quickly, or stays equally accurate. A model with a 128K ceiling may degrade significantly in speed well before that limit and in coherence even sooner. The context lengths actually used in production should be tested directly rather than assumed to match the advertised maximum." }
          ],
          quiz: [
            { q: "A 4,000-word document is 5,000 tokens with one model and 7,500 with another. Why?",
              a: ["One model is smarter",
                  "Different tokenizers split text differently",
                  "Longer documents always compress better",
                  "The KV cache changes word counts"],
              c: 1,
              e: "Different model families use different tokenizers (BPE-style, SentencePiece-style) with different vocabularies, so the same text becomes a different number of tokens." },
            { q: "A model advertises a 128K context window. What can you safely assume?",
              a: ["It runs equally fast at 1K and 100K tokens",
                  "It stays equally accurate across the whole window",
                  "It can technically accept up to 128K tokens, but speed and accuracy may degrade well before that",
                  "It will never run out of memory"],
              c: 2,
              e: "Supported length is a ceiling, not a guarantee. Speed and accuracy can degrade far below the advertised maximum — test the lengths you actually use." },
            { q: "Which of these does the token count directly affect?",
              a: ["Only the speed of generation",
                  "Only how much text fits in context",
                  "Context fit, KV cache size, and prompt-processing latency",
                  "Nothing — tokens are an internal detail"],
              c: 2,
              e: "Tokens are the unit of work. They determine context fit, KV cache size, prefill latency, and how efficiently multilingual or code text is handled." }
          ]
        },
        {
          id: "m1l3",
          title: "Transformers",
          blocks: [
            { t: "p", x: "Most modern LLMs are built on the Transformer architecture. The local chat LLMs covered in this course are decoder-only Transformers: at each step they predict the next token while attending only to tokens that came before in the sequence. This contrasts with encoder-only Transformers (used for classification, search, and embedding generation) and encoder-decoder Transformers (used for translation and other sequence-to-sequence tasks). Decoder-only is the natural fit for chat because the model's job at every step is to extend an existing sequence one token at a time." },
            { t: "visual", id: "transformerStack" },
            { t: "h", x: "A Transformer layer contains" },
            { t: "list", items: [
              "Token embeddings: the lookup that maps token IDs to vectors, introduced in the previous lesson.",
              "Positional information: most 2026 models use RoPE (Rotary Position Embeddings), which encodes a token's position by rotating its vector. RoPE is now the dominant positional scheme and is what makes long-context extension techniques such as YaRN possible — covered in the Applications module's Long Context lesson.",
              "Self-attention: the mechanism that allows each token to selectively incorporate information from prior tokens in the sequence. Detailed in the next lesson.",
              "MLP / feed-forward block: a dense computation applied independently to each token's vector. MLP blocks hold a large fraction of a Transformer's total parameters, which is the structural reason that weight memory in the VRAM math lesson (Module 3) is dominated by these blocks.",
              "Layer normalization and residual connections: supporting infrastructure that stabilizes training of deep networks and allows information from earlier layers to pass through to later ones unchanged.",
              "Output projection: a learned matrix that maps the final hidden-state vector back to logits over the vocabulary."
            ]},
            { t: "p", x: "These components, repeated at every layer, form the Transformer's depth. A 7B model is typically 28–32 such layers; a 70B model is roughly 80; a 200B-class MoE model can exceed 100 layers." },
            { t: "callout", x: "Of these components, two dominate the resource tensions the rest of this course unpacks. Self-attention is the principal source of memory cost during generation (the KV cache, covered next-but-one). MLP blocks are the principal source of parameter cost (covered in the VRAM math lesson in Module 3). Layer normalization, residuals, and positional encoding are structurally essential but contribute little to the total compute or memory budget." },
            { t: "expand", x: "Un-pack — vectors, embeddings, RoPE, self-attention, MLP, layer norm, residuals", blocks: [
              { t: "defs", items: [
                { term: "vector", def: "An ordered list of numerical values. In a Transformer, each token is represented as a vector with hundreds or thousands of components, and those components are the values on which the model performs arithmetic." },
                { term: "embedding", def: "The lookup table that maps each token ID to its vector representation, covered in the previous lesson. The first operation inside the Transformer is replacing token IDs with their embedding vectors; from that point on, all internal computation operates on the vectors rather than the integer IDs." },
                { term: "RoPE", def: "Rotary Position Embeddings. A method for encoding token position by rotating each token's vector by an angle that depends on its index in the sequence. The rotation allows attention to distinguish token #5 from token #500 even when the underlying token value is identical. RoPE is the dominant positional scheme in 2026 models and is what makes long-context extension techniques such as YaRN possible." },
                { term: "self-attention", def: "The mechanism by which each token examines every previous token in the sequence and weights the contribution of each to its own next-token prediction. Called self-attention because the attention is over the model's own sequence rather than a separate one. Detailed in the next lesson." },
                { term: "MLP / feed-forward", def: "A small neural network applied independently to each token's vector to transform it. Information flows in a single direction (input to output), which is what 'feed-forward' refers to. A large fraction of a Transformer's parameters reside in these blocks — for a typical 7B model, the MLP blocks alone account for a majority of the weight memory." },
                { term: "layer normalization", def: "A mathematical operation that rescales the vectors as they flow through dozens of layers, preventing values from drifting too large or too small. Without it, deep networks are unstable to train." },
                { term: "residual connection", def: "A path that adds the input of a layer to its output, allowing the layer to refine the representation rather than replace it entirely. Residual connections are what makes training very deep networks tractable." },
                { term: "output projection", def: "The final operation in a Transformer. The last layer's hidden-state vector is multiplied by a learned matrix (essentially the inverse of the embedding lookup) to produce one logit per token in the vocabulary." },
                { term: "hidden state", def: "Any of the intermediate vectors between the embedding lookup and the final output projection. Called hidden because they are internal representations rather than directly observable inputs or outputs." }
              ]}
            ]}
          ],
          quiz: [
            { q: "Most local chat LLMs are which kind of Transformer?",
              a: ["Encoder-only", "Decoder-only", "Encoder-decoder", "Convolutional"],
              c: 1,
              e: "Local chat models are decoder-only Transformers — they predict the next token while attending only to previous tokens." },
            { q: "What does RoPE provide to the model?",
              a: ["Compression of the KV cache",
                  "Positional information — the order of tokens",
                  "Faster sampling",
                  "The vocabulary"],
              c: 1,
              e: "RoPE (Rotary Position Embeddings) encodes token position by rotating representations, so the model knows token order." },
            { q: "Where do a large fraction of a Transformer's parameters live?",
              a: ["The tokenizer",
                  "The MLP / feed-forward blocks",
                  "The layer norm",
                  "The positional encoding"],
              c: 1,
              e: "The MLP/feed-forward block is a dense nonlinear computation, and a large share of model parameters sit there." }
          ]
        },
        {
          id: "m1l4",
          title: "Attention",
          blocks: [
            { t: "p", x: "Attention is the mechanism that allows each token in the sequence to incorporate information from prior tokens when computing its own next-token prediction. Mechanically, attention takes a weighted average of the value vectors of prior tokens, with the weights determined by how well each prior token's key matches the current token's query. The result is that every token's representation can be influenced by any earlier token in the sequence." },
            { t: "p", x: "Because a decoder-only Transformer must not be allowed to peek at future tokens during training or inference, the attention computation applies a causal mask that zeros out any contribution from tokens that come after the current one. This is the structural difference between decoder-only attention (covered here) and the bidirectional attention used in encoder-only models." },
            { t: "p", x: "Attention computation scales quadratically with sequence length: doubling the context length quadruples both the work and the attention-related memory required. This quadratic cost is the central engineering tension in long-context inference, and is the primary reason long context is expensive even when the model architecturally supports it. The Long Context lesson in the Applications module returns to this constraint in practical detail." },
            { t: "p", x: "Three principal attention variants appear in 2026 local models, distinguished by how they organize the key and value matrices across the attention heads:" },
            { t: "list", items: [
              "MHA (multi-head attention): every attention head maintains its own K and V matrices. Highly expressive but produces the largest KV cache.",
              "MQA (multi-query attention): all attention heads in a layer share a single K and a single V. Dramatically reduces the KV cache, with some loss in expressiveness.",
              "GQA (grouped-query attention): groups of heads share K and V matrices. The practical middle ground; used by most modern local models including Llama 3+, Qwen 3+, and Mistral."
            ]},
            { t: "visual", id: "attentionVariants" },
            { t: "p", x: "Independent of which variant a model uses, the speed of attention computation depends heavily on the runtime's implementation. Modern attention kernels such as FlashAttention and SDPA-style implementations restructure the computation to keep more intermediate data in fast on-chip GPU memory (SRAM) rather than slower off-chip memory (HBM). The math computed is identical to a naive implementation; the difference is in execution efficiency, which can amount to a several-fold speedup on the same hardware and weights." },
            { t: "callout", x: "Attention is the principal source of memory cost during generation — not because the computation itself is large, but because every attention head must retain its K and V matrices for every prior token in the sequence. This per-token, per-head, per-layer state is the KV cache, the subject of the next lesson. The interaction between attention variant (MHA / MQA / GQA), context length, and KV-cache size is the central memory math of running a model locally." },
            { t: "expand", x: "Un-pack — heads, queries, keys, values, causal mask, MHA / MQA / GQA, FlashAttention", blocks: [
              { t: "defs", items: [
                { term: "head", def: "An independent attention channel. A Transformer layer runs several heads in parallel, and different heads can specialize in tracking different aspects of the sequence — syntactic structure, topical relationships, long-range dependencies. A typical model has 16–64 heads per layer." },
                { term: "query (Q)", def: "A vector derived from the current token that represents what information it is requesting from the rest of the sequence. Analogous to a search query in an information retrieval system." },
                { term: "key (K)", def: "A vector derived from each previous token that represents what that token offers as a match. Analogous to a document's title or indexing terms — the query is compared against keys to score relevance." },
                { term: "value (V)", def: "A vector derived from each previous token that represents the content contributed when that token is selected by attention. Analogous to the body of a retrieved document — the actual information used in the next-token computation." },
                { term: "causal mask", def: "A constraint applied during attention that zeros out any contribution from tokens that come after the current one. Enforces the decoder-only property that future tokens cannot influence past predictions, which is required for both training and inference of a decoder-only Transformer." },
                { term: "MHA", def: "Multi-Head Attention. Every head maintains its own separate K and V matrices. Expressive but memory-intensive, since the KV cache stores K and V for every head at every layer." },
                { term: "MQA", def: "Multi-Query Attention. All heads in a layer share a single K and a single V. Substantially smaller KV cache than MHA, at some cost in expressiveness." },
                { term: "GQA", def: "Grouped-Query Attention. A middle ground between MHA and MQA: groups of query heads share a K/V pair (for example, 8 query heads sharing 1 K/V). Used by most modern local models (Llama 3+, Qwen 3+, Mistral) because it preserves most of the quality of MHA at a fraction of the cache cost." },
                { term: "FlashAttention", def: "A fast implementation of attention that keeps more of the computation in fast on-chip GPU memory (SRAM) rather than slower off-chip memory (HBM). The math is unchanged; the result is significantly faster execution with substantially lower memory use. Standard in 2026 runtimes." },
                { term: "SDPA", def: "Scaled Dot-Product Attention — the formal name for the standard attention computation. An SDPA-style kernel typically refers to a modern fused implementation of that computation, such as the one built into PyTorch." }
              ]}
            ]}
          ],
          quiz: [
            { q: "Two 7B models behave very differently at 128K context — one exhausts a 24GB GPU, the other fits easily. The most likely reason?",
              a: ["One has more parameters",
                  "Different attention types — MHA vs GQA — change KV cache size",
                  "One is quantized and the other is not",
                  "Tokenizer differences"],
              c: 1,
              e: "Attention design drives KV cache size. MHA stores separate key/value state per head; GQA shares key/value heads across groups, dramatically reducing memory at long context." },
            { q: "Which attention design is the common middle ground in current local models?",
              a: ["MHA", "MQA", "GQA", "SDPA"],
              c: 2,
              e: "GQA (grouped-query attention) balances expressiveness and memory by sharing key/value heads across groups of query heads." },
            { q: "What do FlashAttention and SDPA-style kernels do?",
              a: ["Increase model parameter count",
                  "Reduce attention memory traffic and keep the GPU busier",
                  "Change the tokenizer",
                  "Quantize the weights"],
              c: 1,
              e: "They are efficient attention implementations. Good kernels can make the same model on the same hardware dramatically faster." }
          ]
        },
        {
          id: "m1l5",
          title: "The KV Cache",
          blocks: [
            { t: "p", x: "Attention requires every token to consider every previous token in the sequence. A naive implementation would recompute the full attention pattern over the entire sequence on every step of the inference loop, which would make generation O(n²) per token and O(n³) over an n-token output — prohibitive at any meaningful sequence length. The KV cache is the optimization that makes generation tractable: it stores the key (K) and value (V) vectors for every prior token at every layer, so that each new token only needs to compute its own K and V and combine them with the cached vectors of its predecessors." },
            { t: "p", x: "The trade is direct: the cache eliminates redundant compute by introducing a memory cost that grows with context length. Weight memory is fixed at load — the weights are loaded once and stay constant for the lifetime of the model — but the KV cache grows by one slice of K and V on every iteration of the loop. Over a long conversation, the KV cache becomes the dominant dynamic memory consumer." },
            { t: "code", x: "tokens × layers × kv_heads × head_dim × precision × 2" },
            { t: "p", x: "Each term in the formula corresponds to a structural fact about the model and its current state. The factor of × 2 accounts for storing K and V as separate matrices. The kv_heads count is the lever set by the attention variant from the previous lesson: MHA matches the query-head count, so kv_heads is high; GQA divides query heads into groups that share K/V, so kv_heads is much lower; MQA shares across all query heads, so kv_heads is one. The same 7B model in MHA versus GQA can produce KV caches that differ by a factor of four or more at identical context length — which is why attention variant choice matters operationally, not just academically." },
            { t: "expand", x: "Un-pack — every symbol in the formula, plus MiB / GiB, FP16, FP8", blocks: [
              { t: "defs", items: [
                { term: "tokens", def: "The number of tokens of context currently held by the model. Increases by one with each generated token." },
                { term: "layers", def: "The number of Transformer blocks the model contains. A 7B model typically has 28–32 layers; a 70B has roughly 80." },
                { term: "kv_heads", def: "The number of key/value head pairs in each layer. MHA matches the query-head count (relatively many); GQA uses far fewer; MQA uses one. This is the primary architectural lever determining whether a KV cache stays small or grows quickly with context length." },
                { term: "head_dim", def: "The dimensionality of each head's vector. Typically 64–128. Fixed by the model architecture." },
                { term: "precision", def: "The number of bytes used to represent each numerical value in the cache. FP16/BF16 uses 2 bytes; FP8/INT8 uses 1 byte. Lower precision proportionally reduces cache size, generally with negligible quality loss." },
                { term: "× 2", def: "Accounts for the cache storing both K (keys) and V (values) — two separate matrices per layer per head." },
                { term: "MiB / GiB", def: "Memory units in base-2 powers. 1 MiB equals 1,048,576 bytes (slightly larger than 1 MB); 1 GiB equals 1,024 MiB. These are the units in which GPU memory is reported by standard tools." },
                { term: "FP16 / BF16", def: "16-bit floating-point formats. Two bytes per value. The default precision for AI computation on modern GPUs. BF16 uses the same byte count as FP16 but a wider numerical range, which is more numerically stable during training." },
                { term: "FP8 / INT8", def: "8-bit numerical formats. One byte per value. Halves the KV cache compared to FP16/BF16, generally with negligible quality loss for inference." },
                { term: "KIVI / KVQuant", def: "Research projects that compress the KV cache to 2-bit or 4-bit precision. Achieving acceptable quality at those bit widths is difficult and is not the default in desktop runtimes." }
              ]}
            ]},
            { t: "p", x: "A useful rule of thumb for older Llama-style 7B MHA models is approximately 0.5 MiB per token in FP16 KV cache. At 4K tokens this works out to roughly 2 GiB; at 32K tokens it approaches 16 GiB — for KV cache alone, before any other memory consumer is counted. The interactive calculator below allows direct experimentation with the formula's terms." },
            { t: "widget", id: "kvCacheCalc" },
            { t: "p", x: "Newer GQA and MQA models reduce these figures substantially — often by a factor of four or more for GQA compared to MHA at identical context length. Some runtimes support FP8 or INT8 KV cache, which represents the practical compression floor for local users in 2026 and approximately halves cache size again. Sub-8-bit KV cache (KIVI, KVQuant) remains research-grade and should be benchmarked carefully before deployment, particularly for coding, tool calls, JSON output, and long-context retrieval." },
            { t: "callout", x: "This is why a model can load successfully with an empty prompt and then fail on a long document. Weight memory is a one-time cost determined at load. KV cache memory is incremental and grows with context. The weights still fit — the working memory required to attend across the full sequence does not. The KV cache is the dynamic term in the VRAM math, a topic returned to in detail in the Hardware Reality module." }
          ],
          quiz: [
            { q: "What is the KV cache?",
              a: ["A copy of the model weights on disk",
                  "Stored key/value attention states for previous tokens, used as working memory during generation",
                  "The tokenizer vocabulary",
                  "A cache of past user prompts"],
              c: 1,
              e: "The KV cache stores key/value attention states so the model doesn't recompute the whole history on every new token." },
            { q: "A model loads fine with a short prompt but crashes when you paste a long document. Why?",
              a: ["The weights got bigger",
                  "The KV cache grows with context length and exhausted memory",
                  "The tokenizer failed",
                  "The GPU lost power"],
              c: 1,
              e: "Weights are fixed in size. The KV cache grows with every token of context — long input can blow the memory budget even though the weights fit." },
            { q: "For local users in 2026, what is the practical KV-cache compression floor?",
              a: ["2-bit KV cache",
                  "FP8 or INT8 KV cache",
                  "FP32 KV cache",
                  "No compression is ever safe"],
              c: 1,
              e: "FP8/INT8 KV cache is the practical floor. Sub-8-bit approaches exist in research but need careful benchmarking before you rely on them." },
            { q: "The KV cache memory grows with which factor?",
              a: ["Only the model's parameter count",
                  "The number of tokens in the active context",
                  "The decoding temperature",
                  "The vocabulary size"],
              c: 1,
              e: "KV cache scales with tokens × layers × kv_heads × head_dim × precision × 2. More context tokens means more cache." }
          ]
        },
        {
          id: "m1l6",
          title: "Prefill and Decode",
          blocks: [
            { t: "p", x: "An inference call passes through two distinct performance regimes. Prefill processes the input prompt; decode generates the output one token at a time. The two regimes have different mechanical structures, different limiting factors, and different optimization strategies — which is why a model that feels fast on a short prompt can feel slow on a long one, or fast on a quick answer but slow on a verbose one." },
            { t: "visual", id: "prefillDecode" },
            { t: "p", x: "The mechanical difference between the two regimes is parallelism. During prefill, every input token is already known, so the model can compute keys and values for all input tokens in a single batched pass with the GPU running near its full compute throughput. During decode, each new output token's keys and values depend on the just-generated previous token, so they must be computed sequentially — one forward pass per token, with the KV cache from the prior lesson carrying the accumulated state forward." },
            { t: "p", x: "Because of this difference, the two regimes hit different bottlenecks. Prefill is typically compute-bound: the GPU performs a large parallel matrix computation and is limited by its raw arithmetic throughput (FLOPs). Decode is typically memory-bandwidth-bound: the GPU must stream all of the model's weights from VRAM through the compute units for every single output token, and the speed at which it can read those weights — not the arithmetic itself — becomes the constraint. This distinction is the foundation of the Memory Bandwidth lesson in the Hardware Reality module." },
            { t: "p", x: "The latency before the first output token appears is called time to first token (TTFT) and is dominated by prefill cost. The streaming rate of the response after that point is dominated by decode rate. A long input punishes TTFT; a long output punishes streaming time; a long conversation punishes both, because the KV cache from every prior turn must be retained and contributes to every subsequent iteration." },
            { t: "callout", x: "Long prompts make prefill expensive. Long answers make decode expensive. Long conversations make both expensive simultaneously, because the KV cache accumulates with every turn. The What Controls Speed lesson in the Hardware Reality module covers the full set of factors that determine tokens per second; production serving engines sometimes disaggregate the two regimes onto separate hardware, a technique covered in the Software Stack module's Production Serving Modes lesson." },
            { t: "p", x: "In a chat session, every conversational turn adds to the cache. At 16,000 tokens of accumulated history, the memory cost of all 16,000 tokens is incurred on every newly generated token — not only on the most recent turn. This is why chat interfaces that retain unlimited history eventually become unresponsive or run out of memory: the cost lives in the cumulative cache, not in any individual turn." }
          ],
          quiz: [
            { q: "Which phase is more sequential and produces the streaming 'typing' effect?",
              a: ["Prefill", "Decode", "Tokenization", "Both equally"],
              c: 1,
              e: "Decode generates tokens one at a time, each depending on the last — that's the streaming effect. Prefill is more parallelizable." },
            { q: "A very long prompt mainly punishes which phase?",
              a: ["Decode", "Prefill", "Neither", "Softmax"],
              c: 1,
              e: "Long prompts punish prefill (processing the input). Long answers punish decode. Long conversations punish both." },
            { q: "Why do chat UIs that keep infinite history eventually slow down or crash?",
              a: ["The model forgets how to generate",
                  "Every turn adds to the KV cache, so you pay memory cost for all accumulated tokens on every new token",
                  "The tokenizer wears out",
                  "Decode becomes parallel"],
              c: 1,
              e: "The KV cache grows with every turn. At 16K tokens of history you pay for all 16K on each generated token, until memory runs out." }
          ]
        },
        {
          id: "m1l7",
          title: "Decoding",
          blocks: [
            { t: "p", x: "After the model produces logits, no output text yet exists — only a score for every possible next token. The model returns a full probability distribution over the vocabulary, not a chosen answer. Returning the distribution rather than a single token is what allows downstream control: every decoding parameter described below operates on this distribution to influence which token is ultimately selected." },
            { t: "p", x: "Decoding is the policy that converts the distribution into one selected token, appends it to the sequence, and allows the loop to continue. The runtime can take the highest-probability token at every step, sample from a narrowed set of likely tokens, penalize repetition, terminate at a delimiter, or run with a fixed random seed for reproducibility. These choices do not change the model's weights, but they substantially affect the output's determinism, creativity, characteristic voice, risk profile, and propensity to loop." },
            { t: "h", x: "Five categories of decoding control" },
            { t: "list", items: [
              "Distribution shape: how sharply concentrated the probability is on the top tokens (temperature).",
              "Tail control: how far into lower-probability tokens the sampler may reach (top-p, top-k).",
              "Repetition control: prevention of degenerate loops where the same tokens are emitted indefinitely (repetition penalty).",
              "Termination control: hard and soft stopping conditions (stop sequences, max tokens).",
              "Structure control: enforcement of grammars or schemas, such as valid JSON (constrained decoding)."
            ]},
            { t: "expand", x: "Un-pack — temperature, top-p, top-k, repetition penalty, stop sequences, greedy, seed", blocks: [
              { t: "defs", items: [
                { term: "temperature", def: "A parameter that scales the logits before softmax is applied. Lower values (0.1–0.5) make the distribution sharper, concentrating probability on the top tokens and producing nearly deterministic output. Higher values (1.0–2.0) flatten the distribution, allowing lower-probability tokens to be selected and producing more varied, more creative, sometimes less accurate output. A temperature of 0 collapses to greedy decoding." },
                { term: "top-p (nucleus)", def: "A sampling rule that restricts selection to the smallest set of tokens whose cumulative probability reaches the threshold p. A top-p of 0.9 means the sampler considers only the tokens that together account for 90% of the probability mass, cutting off the long tail of unlikely tokens." },
                { term: "top-k", def: "A sampling rule that restricts selection to the k highest-probability tokens. A top-k of 5 means the sampler may only choose from the five most likely candidates. Simpler than top-p but coarser, since the threshold ignores the actual probability distribution." },
                { term: "repetition penalty", def: "A multiplier applied to the probability of tokens that have already appeared in the output, reducing their likelihood of being selected again. Prevents the model from entering repetitive loops where the same token is emitted indefinitely." },
                { term: "stop sequence", def: "A string that, when generated, terminates decoding immediately. Useful for enforcing structured output — for example, stopping at a double newline to prevent the model from continuing past the intended response." },
                { term: "max tokens", def: "A hard upper limit on the number of tokens generated in a single response. Prevents runaway output and bounds compute cost." },
                { term: "constrained decoding", def: "A technique that forces the output to conform to a grammar or schema (such as valid JSON) by zeroing the probability of any token that would violate the constraint. Substantially more reliable than relying on the model to follow format instructions in the prompt." },
                { term: "greedy", def: "The special case in which the highest-probability token is always selected. Equivalent to a temperature of 0. Fully deterministic, but brittle — greedy decoding can become trapped in repetitive loops or produce generic output because no alternative paths are ever explored." },
                { term: "seed", def: "An integer that initializes the random number generator used by stochastic sampling. Two runs with the same seed, the same model, and the same prompt produce identical output — essential for reproducibility during evaluation and debugging." }
              ]}
            ]},
            { t: "p", x: "Precision-oriented work calls for narrow settings: low temperature, short max-token limits, explicit stop sequences, and constrained decoding when the output must match JSON or a defined schema. Creative work tolerates wider sampler settings. Code generation typically benefits from a conservative first pass, with broader sampling reserved for intentional exploration of alternatives — covered in detail in the Coding With Local Models lesson. Agents that emit structured tool calls should default to constrained decoding rather than relying on the model's ability to follow format instructions, covered in the Local Agents lesson." },
            { t: "callout", x: "Greedy decoding is not necessarily more accurate — it is often brittle. A greedy decoder can become trapped in loops or settle on generic completions because no alternative paths are ever explored. Deterministic settings are appropriate for evaluation; broader sampling settings are appropriate for ideation and exploration. Any honest benchmark must specify the exact decoding settings used, as covered in the Benchmarks That Matter lesson." },
            { t: "widget", id: "decodingPlayground" }
          ],
          quiz: [
            { q: "Does changing decoding settings (temperature, top-p) change the model's weights?",
              a: ["Yes, it retrains the model",
                  "No — it only changes how scores are turned into selected tokens",
                  "Yes, but only temporarily",
                  "Only for quantized models"],
              c: 1,
              e: "Decoding is a policy applied to the model's output scores. It changes voice, determinism, and creativity, but never the weights." },
            { q: "You need reliable JSON output that matches a schema. Best decoding approach?",
              a: ["High temperature for creativity",
                  "Low temperature, explicit stop sequences, and constrained decoding",
                  "Greedy decoding alone guarantees valid JSON",
                  "Maximum top-p"],
              c: 1,
              e: "Precise/structured work wants narrow settings — low temperature, stop sequences, and constrained decoding to enforce the schema." },
            { q: "Why is greedy decoding not always the most accurate choice?",
              a: ["It changes the weights",
                  "It is brittle — it can loop or produce generic answers because it never explores alternatives",
                  "It is always slower",
                  "It ignores the prompt"],
              c: 1,
              e: "Always picking the top token can trap the model in loops or generic output. Use deterministic settings for evals, but greedy is not automatically 'best.'" }
          ]
        }
      ]
    },

    {
      id: "m2",
      title: "The Model Package",
      summary: "What ships inside a downloaded model: package contents, chat templates, the base/instruct/chat/reasoning/tool-tuned spectrum, file formats and load safety, and the quantization choices that govern memory and quality.",
      lessons: [
        {
          id: "m2l1",
          title: "What a Model Package Contains",
          blocks: [
            { t: "p", x: "A runnable local LLM is not a single file. A complete model package is a bundle of distinct artifacts that must travel together and remain consistent with one another. The weights are the largest piece by far, but they are useless without the metadata, tokenizer, and templates that tell the runtime how to use them." },
            { t: "list", items: [
              "Architecture and configuration: layer count, hidden size, attention variant (MHA / GQA / MQA), RoPE settings, vocabulary size, special tokens, and the maximum context length the model was trained at. These are the values referenced throughout the Inference Loop module — they tell the runtime how to construct the network in memory before any weights are loaded.",
              "Weights: the learned numerical values produced by training. Stored in a format chosen by the publisher; safetensors and GGUF are the common modern choices, with format-specific implications covered in the File Formats and Load Safety lesson and bit-width implications covered in the Quantization lesson.",
              "Tokenizer: the algorithm and vocabulary that convert text into the token IDs the model operates on, introduced in the Tokens lesson. Without the matching tokenizer, the model would receive integer IDs that mean something different from what the weights expect.",
              "Chat template: the specific markup that delineates system messages, user messages, assistant messages, tool calls, and any reasoning blocks for this particular model. The next lesson covers chat templates in their own right; templates are the most failure-prone piece of a package because they are model-specific and easy to misapply.",
              "Generation configuration: the publisher's recommended defaults for temperature, top-p, repetition penalty, stop sequences, and maximum output length. Sensible starting values, not commitments — see the Decoding lesson for the full meaning of each parameter.",
              "License and model card: the legal terms governing use and the operational guidance describing intended applications, known limitations, training data summary, and evaluation results. The model card serves as the README and the legal document combined."
            ]},
            { t: "p", x: "On disk, a model package from Hugging Face typically appears as a directory containing config.json, tokenizer.json (or tokenizer.model), model.safetensors (or sharded model-00001-of-N.safetensors files), generation_config.json, and a README.md serving as the model card. A GGUF package, by contrast, bundles all of these into a single .gguf file with the metadata embedded — convenient for desktop runtimes such as LM Studio. The packaging differs across formats; the conceptual contents do not." },
            { t: "p", x: "Most local-runnable packages are distributed through Hugging Face, with secondary distribution through runtime-specific hubs (Ollama Hub for Ollama, and the model authors' own sites for some research releases). Hugging Face packages are versioned via git revisions, so the model card can describe what changed between revisions — worth checking when reproducibility matters." },
            { t: "callout", x: "The weights account for the bulk of a package's size but do not constitute the entire model. When the tokenizer, configuration, chat template, or generation defaults fail to match the weights, output becomes malformed — role confusion, garbled tokens, missing stop conditions, broken tool calls — even though the weights themselves are intact. Diagnosing this class of bug requires inspecting the package contents rather than questioning the model's training quality. The Failure Modes and Fixes lesson in the Operating in Practice module returns to this distinction explicitly." }
          ],
          quiz: [
            { q: "Which of these is NOT typically part of a model package?",
              a: ["Architecture / config", "Weights", "The user's prompts", "Tokenizer"],
              c: 2,
              e: "A package contains config, weights, tokenizer, chat template, generation defaults, and a license. User prompts are runtime input, not part of the model." },
            { q: "Same weights, but the model feels broken. What's the most likely cause?",
              a: ["The weights got corrupted", "The tokenizer, config, or chat template is wrong", "The GPU drivers updated", "The user's prompt was too short"],
              c: 1,
              e: "If the tokenizer, config, or chat template doesn't match what the weights expect, you get garbage even though the model is fine." },
            { q: "What does the model card primarily contain?",
              a: ["The weights in compressed form", "The legal license and operational guidance for use", "The tokenizer state", "The fine-tuning data"],
              c: 1,
              e: "The model card is the README — license, intended use, known limitations, and operational instructions for running it." }
          ]
        },
        {
          id: "m2l2",
          title: "Chat Templates",
          blocks: [
            { t: "p", x: "A chat template is the markup convention a chat-tuned model expects for delineating the different roles in a conversation — system instructions, user messages, assistant turns, tool calls, and (in some 2026 models) explicit reasoning blocks. The template is not decorative formatting; it is the contract the model was trained against. A model only knows how to behave correctly when input follows the same pattern its training data used." },
            { t: "p", x: "Different model families use different templates, and they are not interchangeable. One model may expect tags such as <|system|> ... <|user|> ... <|assistant|>; another expects [BOS] [INST] ... [/INST]; another uses ChatML-style markers <|im_start|>user / <|im_end|>; another requires explicit reasoning tokens. The interactive explorer below allows direct comparison across the major template families." },
            { t: "code", x: "<|system|>\nYou are a helpful assistant.\n<|user|>\nExplain KV cache.\n<|assistant|>" },
            { t: "widget", id: "chatTemplateExplorer" },
            { t: "p", x: "Using the wrong template for a model produces multiple failure modes simultaneously: gibberish output, role confusion (the assistant taking on the user's instructions or vice versa), ignored system prompts, missing or premature stop conditions, broken tool calls, refusal weirdness, and unreliable benchmark results. The diagnosis often lands on the model — 'this model is dumb' — when the actual bug is in the markup wrapping the messages." },
            { t: "p", x: "Two 2026-specific categories warrant explicit attention. Reasoning-tuned models (DeepSeek R1, Qwen 3 thinking, GLM-Z, Nemotron Ultra and similar) require specific reasoning-mode tokens that switch the model into emitting an internal thinking block before the answer. Skipping these tokens makes the reasoning model behave like an ordinary chat model — useful when that is the goal, broken when it is not. Tool-use models require specific markup for tool calls and tool responses, often a JSON or XML wrapper inside a designated assistant turn; the exact schema is documented in the model card." },
            { t: "h", x: "How to find the right template for a model" },
            { t: "list", items: [
              "The model's tokenizer_config.json file (in a Hugging Face package) contains the chat_template field with the exact rendering rules.",
              "The model card usually documents the expected template with concrete examples.",
              "For Transformers, calling tokenizer.apply_chat_template(messages, ...) automatically uses the model's own template — the correct programmatic interface.",
              "For llama.cpp, LM Studio, vLLM, and SGLang, the template is typically loaded automatically from the model's GGUF or safetensors metadata; verify the runtime's template-selection behavior when output looks wrong."
            ]},
            { t: "expand", x: "Un-pack — special tokens, BOS, EOS, ChatML, [INST], apply_chat_template, reasoning tokens", blocks: [
              { t: "defs", items: [
                { term: "special token", def: "A token in the vocabulary that does not represent regular text. Used as a structural marker: 'system message starts here,' 'assistant turn ends here,' 'this is a tool call,' and so on. Most chat templates are built primarily from special tokens." },
                { term: "BOS", def: "Beginning Of Sequence. A special token (often <s> or <|begin_of_text|>) that marks the very start of the conversation. Some models require it; others infer it. The model card or tokenizer config indicates which." },
                { term: "EOS", def: "End Of Sequence. The token the model emits when it has decided to stop. The runtime watches for this token and halts decoding when it appears." },
                { term: "ChatML", def: "A specific chat-template style originally invented for OpenAI's models. Uses tags such as <|im_start|>user and <|im_end|>. Many other models borrow the convention; many also define their own variants." },
                { term: "[INST] / [/INST]", def: "The Mistral and Llama 2 family's tags for marking a user instruction within an otherwise unmarked stream of text. A historical convention; later model families moved to more explicit role tokens." },
                { term: "apply_chat_template", def: "A function in the Hugging Face Transformers library that takes a list of message objects and renders them using the template defined in the tokenizer's config. The correct programmatic interface for chat formatting; constructing markup by hand is error-prone and brittle to template changes." },
                { term: "reasoning tokens", def: "Special markers some 2026 models use to switch into 'thinking mode,' emitting an internal reasoning block before the actual answer. Examples include the <think>...</think> wrapper used by several reasoning-tuned families. Skipping these tokens causes the model to behave as an ordinary chat model — sometimes desirable, sometimes a bug." }
              ]}
            ]},
            { t: "h", x: "Best practice" },
            { t: "list", items: [
              "When using Hugging Face Transformers, call tokenizer.apply_chat_template rather than writing markup directly.",
              "When using llama.cpp, LM Studio, vLLM, or SGLang, confirm the runtime is applying the model-specific template, not a generic default.",
              "Base models do not have or require a chat template — they complete the prompt rather than respond to it. This distinction is covered in the next lesson on model types.",
              "Verify BOS and EOS handling. A missing BOS or a mishandled EOS produces immediately recognizable failure modes.",
              "For tool use, follow the exact schema the model expects. Constrained decoding from the Decoding lesson is the reliable way to enforce structured tool-call output."
            ]},
            { t: "callout", x: "The chat template is the contract between the prompt and the model. A wrong template means the model is not being tested or used as it was trained — every observation about behavior, quality, or speed becomes unreliable. When something feels wrong, verify the template before questioning the model. The Failure Modes and Fixes lesson in the Operating in Practice module covers this as the first check for the gibberish-or-role-confusion class of bug." }
          ],
          quiz: [
            { q: "Using the wrong chat template can cause…",
              a: ["Faster inference", "Smaller memory footprint", "Gibberish, role confusion, ignored system prompts, broken tool calls", "The model to refuse all requests"],
              c: 2,
              e: "A chat model expects a specific format; using the wrong one corrupts the conversation structure and the model misbehaves in many ways at once." },
            { q: "How should you format chats programmatically with Hugging Face Transformers?",
              a: ["Write the markup string yourself", "Call tokenizer.apply_chat_template", "Send a single user message with everything inline", "Skip the system prompt"],
              c: 1,
              e: "apply_chat_template renders your messages using the tokenizer's own template — the correct, model-specific format every time." },
            { q: "A model returns weird role confusion or seems to ignore the system prompt. First thing to check?",
              a: ["The model weights are corrupt", "GPU memory pressure", "The chat template format", "The temperature setting"],
              c: 2,
              e: "Template bugs are by far the most common cause of role confusion and ignored system prompts — verify first, blame the model last." },
            { q: "Treat the chat template like…",
              a: ["A cosmetic detail", "An API contract", "The tokenizer", "A debugging tool"],
              c: 1,
              e: "If you get it wrong, you're not testing the model you think you're testing." }
          ]
        },
        {
          id: "m2l3",
          title: "Model Types",
          blocks: [
            { t: "p", x: "Not all LLMs are tuned for the same behavior. A model's type is determined by what was done to it after pretraining — supervised fine-tuning on instruction-following data, reinforcement learning from human or model preferences, training on tool-use examples, or no post-training at all. Each post-training process produces a model with distinct expected behavior, distinct chat-template requirements (see the previous lesson), and a distinct set of best-fit use cases." },
            { t: "list", items: [
              "Base model: pretrained only, no instruction tuning. Good for further training, research, and custom pipelines. Completes the prompt rather than answers it — asking 'What is the capital of France?' may produce a continuation like 'and what is the population of Paris?' instead of the answer 'Paris.'",
              "Instruct model: post-trained on instruction-following data. Good for one-shot directives such as 'summarize this document' or 'write a function that does X.'",
              "Chat model: instruction-tuned with additional emphasis on multi-turn dialogue and role formatting. Good for back-and-forth conversation, follow-up questions, and assistant-style interaction.",
              "Reasoning model: post-trained to use thinking-mode tokens and to verify intermediate steps. Good when the task benefits from longer chains of thought — math, complex coding, structured planning, multi-step analysis. Slower per answer because the reasoning block consumes tokens before the final response, but often more accurate on hard problems.",
              "Tool-tuned model: post-trained on examples of structured tool calls, JSON outputs, and function-use reasoning. Good when the model must emit valid structured calls reliably — agent stacks, RAG systems, code assistants that invoke compilers or test runners. Covered further in the Local Agents lesson.",
              "Hybrid (thinking-and-non-thinking) model: a 2026-specific category. The same model can be invoked in two modes — fast direct answers, or longer reasoning chains — controlled by a special token at the start of the assistant turn. Qwen 3, Nemotron Ultra, and GLM-Z are examples."
            ]},
            { t: "p", x: "For most users, the default starting point is a recent instruct- or chat-tuned model in a size that fits comfortably in the available memory. Base models should not be the first attempt unless there is a specific reason — they require careful prompt engineering to produce useful answers and are most appropriate as starting points for fine-tuning (covered in the Applications module). Reasoning and tool-tuned variants are worth selecting when the task explicitly benefits from those capabilities; otherwise the additional generation cost (reasoning produces more tokens; tool-tuned models can carry structured-output overhead) is unnecessary." },
            { t: "p", x: "Model type is usually identifiable from the model's name. Suffixes such as -Instruct, -Chat, -Reasoning, -Thinking, -Coder, or -Tool typically indicate the post-training variant; -Base or the absence of a suffix usually indicates the base model. The model card on Hugging Face documents the type explicitly and shows the recommended chat template. The interactive explorer below pairs each type with a representative scenario where it is the right fit." },
            { t: "widget", id: "modelTypeExplorer" },
            { t: "callout", x: "The wizard in this site recommends a model type from the selected use case — chat, coding, documents, agents, reasoning, or edge — and pairs the type with quantization and runtime recommendations. The Choose a Model That Fits lesson in the Operating in Practice module walks through the full selection framework, including memory, license, and runtime compatibility." }
          ],
          quiz: [
            { q: "You ask a model 'What is the capital of France?' and it replies 'and what is the population of Paris?' What kind of model is this most likely?",
              a: ["Instruct model", "Base model", "Chat model", "Reasoning model"],
              c: 1,
              e: "Base models complete your prompt rather than answer it. They're useful for fine-tuning, not for direct use." },
            { q: "Which model type is the default starting point for most users?",
              a: ["Base model", "Recent instruct / chat-tuned model", "Reasoning model with no chat tuning", "Tool-tuned model with no chat history"],
              c: 1,
              e: "A recent instruct or chat-tuned model in a size that fits comfortably in memory is the right default." },
            { q: "Which model would you pick for an agent that needs reliable structured JSON output?",
              a: ["A base model", "A tool-tuned model", "A reasoning model with no tool training", "A chat model with no special tuning"],
              c: 1,
              e: "Tool-tuned models are trained to emit valid structured calls. Other types can produce JSON but with worse reliability." }
          ]
        },
        {
          id: "m2l4",
          title: "File Formats and Load Safety",
          blocks: [
            { t: "p", x: "Once a model's weights have been trained or quantized, they are serialized to disk in one of several file formats. These formats vary along two practically important axes: load safety (whether the file can contain executable code that runs during loading) and runtime fit (which inference engines can read the file directly). Both axes determine real choices when downloading and running a model." },
            { t: "p", x: "safetensors is a safe tensor serialization format designed to store tensors without the executable-code risk of Python pickle. It contains only numerical data and a header describing tensor shapes and dtypes — loading it cannot execute arbitrary code under any circumstances. It is the default format for Hugging Face Transformers and the recommended choice for any safetensors-compatible workflow." },
            { t: "callout", x: "Avoid loading model files in pickle-based formats (.bin, .pt, .pth) from untrusted sources. Python's pickle deserialization is a code-execution path: a maliciously crafted file can execute arbitrary code on the machine that loads it. Real incidents on public model hubs have exploited this since at least 2023. The safer alternatives — safetensors and GGUF — store only numerical data and cannot trigger code execution on load. A separate but related risk applies when loading Hugging Face models with the trust_remote_code flag enabled, defined in the Un-pack defs below." },
            { t: "h", x: "Format landscape" },
            { t: "list", items: [
              "GGUF: the llama.cpp ecosystem's binary format. Bundles weights, tokenizer, chat template, and configuration into a single file — the convenience win that makes desktop tools like LM Studio and Ollama possible. The right choice for llama.cpp, CPU inference, Apple Silicon, and any portable single-file workflow.",
              "safetensors: the default for the Hugging Face / Transformers / PyTorch stack. Used by vLLM, SGLang, ExLlamaV2/V3, and most research releases. Large models are sharded into multiple files (model-00001-of-N.safetensors) with an index file describing how to reassemble them.",
              "ONNX: a framework-agnostic standardized format. Used when deploying outside the PyTorch stack — Intel NPUs, ARM accelerators, mobile chips, browser runtimes via WebGPU.",
              "TensorRT engine: NVIDIA's compiled-engine format produced by TensorRT-LLM. Tuned for a specific GPU architecture and quantization configuration; achieves the highest throughput on supported NVIDIA hardware but requires per-deployment compilation.",
              "EXL2 / GPTQ / AWQ: GPU-focused quantized formats common in single-GPU enthusiast inference, especially with ExLlamaV2/V3 and similar consumer CUDA engines. Each format encodes the quantized weights along with the metadata needed to dequantize them at inference time. Quantization itself is the subject of the next lesson."
            ]},
            { t: "p", x: "Most formats can be converted between each other when needed. A Hugging Face safetensors model can be converted to GGUF with llama.cpp's convert script; safetensors can be converted to ONNX via Hugging Face Optimum or vendor tooling. Conversion preserves the weights but can require re-quantization when the source and target use different bit-width or grouping conventions." },
            { t: "expand", x: "Un-pack — safetensors, GGUF, ONNX, TensorRT, GPTQ, AWQ, EXL2, pickle, trust_remote_code", blocks: [
              { t: "defs", items: [
                { term: "safetensors", def: "A file format for storing model weights as raw numerical data plus a header describing tensor shapes and dtypes. Contains no executable code; loading cannot trigger arbitrary code execution. The default for Hugging Face Transformers." },
                { term: "GGUF", def: "The file format llama.cpp uses. A single file bundles weights, tokenizer, chat template, and configuration — the property that lets desktop runtimes (LM Studio, Ollama) work without a multi-file project structure. Ideal for desktop inference, CPU runtimes, and Apple Silicon." },
                { term: "ONNX", def: "Open Neural Network Exchange. A framework-agnostic format that allows the same model to run on diverse accelerators (Intel NPUs, ARM, mobile chips, browser WebGPU). Used when deployment targets are outside the PyTorch ecosystem." },
                { term: "TensorRT engine", def: "NVIDIA's compiled-engine format produced by the TensorRT-LLM compiler. Tuned for a specific GPU architecture and quantization configuration; achieves top throughput on supported NVIDIA hardware but requires per-deployment compilation." },
                { term: "GPTQ", def: "A weight-quantization method (originally 2022, typically 4-bit). Still common in the GPU-quantization landscape. Provides decent quality and fast inference on GPU; superseded for many new deployments by AWQ and AWQ-variant approaches." },
                { term: "AWQ", def: "Activation-aware Weight Quantization. A quantization method that preserves the weights most important for the activations observed during a small calibration pass. Generally produces better quality than GPTQ at the same bit width." },
                { term: "EXL2", def: "ExLlamaV2's quantized weight format. Allows mixed bit widths per layer to hit a target average — useful for squeezing larger models into a single consumer GPU." },
                { term: "pickle", def: "Python's built-in serialization format (used in .bin, .pt, .pth files). Deserialization is a code-execution path: a maliciously crafted pickle file can run arbitrary code when loaded. The reason safetensors was created." },
                { term: "trust_remote_code", def: "A flag in Hugging Face Transformers that allows a downloaded model package to run its own custom Python code at load time, defined in files the publisher ships alongside the weights. Convenient for new architectures that the Transformers library does not yet support natively, but also a code-execution path for any malicious or compromised model package. Default to False unless the publisher is trusted; covered further in the Privacy Is Not Automatic lesson." }
              ]}
            ]},
            { t: "p", x: "The file format choice is operationally consequential. It determines which inference engines can load the model directly, which quantization formats are supported, how easy it is to bundle the model for distribution, and what conversion overhead is required when changing runtimes. The choice of runtime — covered in the Software Stack module — often forces a choice of file format, and vice versa; the Runtimes and Choosing an Engine lesson walks through the runtime-format coupling in detail." }
          ],
          quiz: [
            { q: "Which file format avoids the Python pickle code-execution risk?",
              a: [".bin", ".pt", "safetensors", ".pth"],
              c: 2,
              e: "safetensors stores just numbers — no code execution path. The others use pickle and can run arbitrary code on load." },
            { q: "GGUF is associated with which runtime ecosystem?",
              a: ["vLLM", "TensorRT-LLM", "llama.cpp / LM Studio / Ollama", "ONNX Runtime only"],
              c: 2,
              e: "GGUF is llama.cpp's format and the standard for desktop runtimes built on it." },
            { q: "TensorRT-LLM is best used for…",
              a: ["Quick desktop experiments", "Maximum throughput on NVIDIA hardware in production", "Apple Silicon inference", "Browser-based inference"],
              c: 1,
              e: "TensorRT-LLM compiles a model into a GPU-specific engine for top throughput. More setup; production-tier choice." },
            { q: "A friend sends you model.bin from an untrusted source. What's the risk?",
              a: ["It will just be slow to load", "The file extension might be wrong", "Pickle-based loading can execute arbitrary code on your machine", "It won't load on modern hardware"],
              c: 2,
              e: "Local AI security rule #1: don't let a stranger's model file become a stranger's code execution. Prefer safetensors or GGUF." }
          ]
        },
        {
          id: "m2l5",
          title: "Quantization",
          blocks: [
            { t: "p", x: "Quantization stores model weights in lower numerical precision to reduce memory consumption and improve inference speed. Mechanically, the weights — originally floating-point values typically in FP16 or BF16 — are rounded to a smaller set of representable values, with scale factors (and sometimes additional metadata such as zero points or group offsets) stored alongside the quantized weights so the runtime can dequantize them at compute time. The reduction in bytes per weight is approximately linear with the bit-width drop." },
            { t: "p", x: "Beyond memory savings, quantization speeds up generation. Decode is memory-bandwidth-bound (covered in the Hardware Reality module's Memory Bandwidth lesson) — every output token requires streaming the model's weights from VRAM through the compute units. Halving the weight precision approximately halves the bytes that must be streamed per token, which directly improves tokens-per-second on bandwidth-limited hardware." },
            { t: "h", x: "2026 rule of thumb" },
            { t: "list", items: [
              "FP16 / BF16: 2 bytes per weight. Best quality when memory is abundant. Use as an evaluation baseline.",
              "FP8 / INT8 / Q8: 1 byte per weight. Near-lossless for most tasks. Reasonable when VRAM is available.",
              "Q6 / Q5: roughly 0.625–0.75 bytes per weight. Excellent quality with moderate savings; a strong middle ground.",
              "Q4: roughly 0.5 bytes per weight (plus metadata overhead). The default consumer sweet spot for chat and document workflows.",
              "Q3 / Q2: 0.375 bytes per weight and below. Only when fitting a larger model matters more than precision. Math, code, structured output, and tool-use reliability degrade first as bit width drops."
            ]},
            { t: "p", x: "Modern quantized formats — including GGUF's K-quants (Q4_K_M, Q5_K_S, and similar), AWQ, and GPTQ — use group-wise quantization rather than uniform quantization: weights are divided into small groups (typically 32, 64, or 128 weights per group), and each group gets its own scale factor. This preserves quality substantially better than naive uniform quantization at the same nominal bit width, at the cost of a small metadata overhead — which is why the bytes-per-weight values above are approximate rather than exact. AWQ specifically uses calibration data to identify which weights are most important for typical activations and preserves those weights at higher fidelity than a uniform quantization would." },
            { t: "p", x: "Weight quantization is not the same as KV-cache quantization, even though both reduce numerical precision. Weight quantization shrinks the model itself, applied once when the model is loaded or downloaded. KV-cache quantization shrinks the per-token state generated during inference, applied dynamically as the cache grows. The two are independent knobs and can be combined: Q4 weight quantization with FP8 KV cache is a common configuration on memory-constrained hardware. For KV cache, FP16/BF16 is the clean baseline and FP8/INT8 is the practical local floor in 2026, as covered in the KV Cache lesson." },
            { t: "p", x: "A third category — activation quantization — applies to the intermediate computations during the forward pass rather than to stored weights or stored cache. NVFP4 and MXFP4 on Blackwell-class NVIDIA GPUs are examples: the hardware supports 4-bit floating-point activations natively, reducing compute energy and memory traffic during execution. Activation quantization is largely a runtime-and-hardware concern rather than something selected when downloading a model; the Inference Research lesson in the Operating in Practice module covers it further." },
            { t: "callout", x: "A smaller model at higher precision can outperform a larger model crushed into too few bits. A 7B model at Q6 frequently beats a 13B model at Q2 on reasoning, code, and structured-output tasks while using less memory and decoding faster. Parameter count alone is a poor proxy for capability when quantization differs across the comparison." },
            { t: "widget", id: "quantizationTable" },
            { t: "p", x: "The quantization table above pairs model sizes with quantization levels and indicates which configurations fit on common hardware tiers. The full memory math — weights plus KV cache plus runtime overhead plus safety margin — is the subject of the VRAM Math for Local Models lesson in the Hardware Reality module." }
          ],
          quiz: [
            { q: "What's the typical 'consumer sweet spot' quantization for chat and document workflows?",
              a: ["FP16", "Q2", "Q4", "Q8"],
              c: 2,
              e: "Q4 hits the best size / quality / speed balance for most chat and document use cases on consumer hardware." },
            { q: "Which is true about weight vs. KV-cache quantization?",
              a: ["They're the same thing", "Weight quant shrinks the model; KV-cache quant shrinks the live context memory", "KV cache can't be quantized", "Only KV cache can be quantized"],
              c: 1,
              e: "Two different knobs on two different memory consumers. Both matter." },
            { q: "When aggressive quantization (Q3 / Q2) breaks things, what suffers FIRST?",
              a: ["Inference speed", "Math, code, structured output, and tool-use reliability", "The model's vocabulary", "The chat template"],
              c: 1,
              e: "Reasoning and structured-output tasks lose quality before chitchat does." },
            { q: "A 7B at Q6 vs a 13B at Q2 on reasoning tasks — usually which wins?",
              a: ["13B always — more parameters is always better", "The 7B at Q6, often with less memory and faster speed", "They're always equal", "It depends only on the GPU brand"],
              c: 1,
              e: "A smaller model at higher precision can beat a larger model crushed too low. Don't worship parameter count." }
          ]
        }
      ]
    },

    {
      id: "m3",
      title: "Hardware Reality",
      summary: "What 'local' really means, the capacity math that decides whether a model fits, the bandwidth that decides how fast it runs, hardware tiers in practice, and the factors that combine into tokens per second.",
      lessons: [
        {
          id: "m3l1",
          title: "What Local Really Means",
          blocks: [
            { t: "p", x: "A local LLM deployment is one where the model weights and the inference runtime sit on hardware controlled by the operator. The choice of which model loads, how it is configured, what data reaches it, and what happens to the outputs is entirely local. That control is the only property local grants automatically — every other desirable trait, including privacy, offline operation, low cost, and safety, must be engineered on top of it." },
            { t: "p", x: "Module 1 covered what a Transformer does during a single inference pass, and Module 2 covered the contents of a model package. This module shifts to what running that package on real hardware actually requires. The current lesson defines the choice, names what local does and does not deliver, and previews the ingredients the rest of the course unpacks." },
            { t: "h", x: "Where local runs" },
            { t: "list", items: [
              "On-device, 1B–4B parameter models on phones, tablets, and laptops with integrated NPUs — voice assistants, dictation, on-device summarization, and simple agents that must function without network.",
              "Consumer GPU, 7B–14B models on a single 12–24 GB card — the everyday chat-and-coding tier where most individual practitioners operate.",
              "Workstation, 30B–70B models on a high-end discrete GPU or a unified-memory Apple Silicon machine — serious individual work, small-team services, and longer-context document workflows.",
              "Server, sparse MoE and large dense models on one or more datacenter GPUs — private deployments at meaningful concurrency, where local begins to mean self-hosted production rather than desktop experimentation.",
              "Across all tiers, the same model can run under different runtimes — vLLM, SGLang, TensorRT-LLM, llama.cpp, LM Studio, MLX, or a custom PyTorch stack. Runtime choice is a separate axis from hardware tier, covered in Module 4."
            ]},
            { t: "callout", x: "Local does not automatically mean offline, private, safe, cheap, or open-source. It only means the operator is running the model. Every property beyond that control is achievable but must be engineered deliberately." },
            { t: "h", x: "Why each property must be engineered" },
            { t: "list", items: [
              "Privacy: the model weights themselves transmit nothing, but the application surrounding the model can — telemetry, error reporting, automatic model updates, retrieval against remote sources, and tool calls to external APIs all reopen the data path. A local deployment is private only when the entire path is audited.",
              "Offline operation: many wrappers around local models still require network connectivity for updates, web search tools, retrieval, or vendor integrations. Operating without network requires selecting components that function disconnected and disabling those that do not.",
              "Cost: hardware capital expense, electricity, operations time, and the steady churn of new model releases all aggregate. At low query volume a hosted API is frequently cheaper than amortizing a workstation GPU. Local wins on cost at high throughput, long-running tasks, or workloads with very large prompts and responses.",
              "Safety: prompt injection through tools and retrieved documents still applies; weight files from untrusted sources can carry executable code through older serialization formats; models still hallucinate, can be jailbroken, and can leak fragments of training data on contrived prompts. Running locally removes the vendor from the threat model but does not remove the model itself.",
              "Open-weight versus open-source: a model whose weights are publicly downloadable is not necessarily licensed for commercial use, redistribution, or services that compete with the publisher. The license matters as much as the availability — check it before building a product on the weights."
            ]},
            { t: "h", x: "When local is the right tool" },
            { t: "list", items: [
              "Privacy or compliance: regulated data that cannot leave the operator's environment — health records, legal documents, internal source code, customer communications.",
              "Latency: tight feedback loops where a round-trip to a remote API breaks the workflow — code completion, voice transcription, interactive editing.",
              "Custom behavior: a model fine-tuned, LoRA-adapted, or system-prompted in ways a vendor's hosted endpoint does not permit.",
              "Offline operation: deployments without reliable network — field work, edge devices, secure facilities, travel.",
              "Cost at scale: workloads heavy enough that amortized hardware cost beats per-token API pricing, particularly when prompts are long, responses are long, or both."
            ]},
            { t: "h", x: "When a hosted API is the better choice" },
            { t: "list", items: [
              "Quality ceiling matters most and the matching hardware is not available — frontier models often require capacity well beyond a single workstation, and a hosted endpoint will outperform any locally runnable model on the hardest reasoning, longest contexts, and most demanding tool use.",
              "Volume is low and bursty — a few hundred queries a week does not amortize a serious GPU, and time spent on operations will exceed the equivalent API bill.",
              "The team lacks operations capacity — keeping a local stack healthy across model updates, runtime updates, and OS changes is ongoing work, not a one-time setup."
            ]},
            { t: "callout", x: "A working local stack combines four ingredients: a model that fits the hardware (covered in the next lesson and in Hardware Tiers in Practice later in this module); the correct prompt format for that model (chat templates, Module 2); a runtime that exposes the model correctly (engines and serving, Module 4); and realistic evaluation against the intended workload (operating in practice, Module 6). The rest of the course works through each ingredient in detail." }
          ],
          quiz: [
            { q: "Which is TRUE of running models locally?",
              a: ["Local always means private", "Local always means offline", "Local means you control what model runs and how", "Local always means free"],
              c: 2,
              e: "Local just means you run the model yourself. It does NOT automatically mean offline, private, safe, or cheap." },
            { q: "When is a hosted API the better choice over local?",
              a: ["Always", "When you need absolute best quality and lack the matching hardware", "For sensitive private data", "For offline operation"],
              c: 1,
              e: "If quality matters most and the best models won't fit on your hardware, a hosted API is the right tool." },
            { q: "The success formula for local LLMs combines…",
              a: ["Just a powerful enough GPU", "Just a recent model", "Model fit + correct prompt format + good runtime + realistic evals", "Big VRAM and small models"],
              c: 2,
              e: "All four pieces matter — get any one wrong and the whole stack feels broken." }
          ]
        },
        {
          id: "m3l2",
          title: "VRAM Math for Local Models",
          blocks: [
            { t: "p", x: "Total memory consumption for a loaded model is best understood as a layered budget rather than a flat sum. Some components are determined at load time and never change; some scale with the active context; some scale with how many requests are served concurrently; some appear only when specific features are enabled. The local stack works when the layered total — plus a headroom margin for fragmentation and unexpected allocations — fits within the available VRAM (or, on unified-memory systems, the shared memory pool)." },
            { t: "p", x: "Weight memory is the dominant fixed-at-load term. The rough formula is weights ≈ parameters × bytes_per_parameter. FP16 / BF16 ≈ 2 bytes per parameter; INT8 / Q8 ≈ 1 byte per parameter; Q4 ≈ 0.5 bytes per parameter plus a small per-group metadata overhead for modern K-quant, AWQ, and GPTQ formats." },
            { t: "p", x: "KV cache memory is the dominant scales-with-context term. A back-of-envelope estimate is KV_cache ≈ 2 × layers × hidden_dim × context_tokens × bytes_per_element, optionally divided by a GQA factor when the model uses grouped-query attention (which most modern Transformers do). The factor of two accounts for both the key and value tensors. For a 13B-class model at 32K context in FP16, this lands in the multi-gigabyte range and grows linearly as context extends." },
            { t: "code", x: "total_memory = quantized_weights\n             + runtime_overhead\n             + KV_cache_for_active_context\n             + batch_or_concurrency_overhead\n             + optional_add_ons\n             + safety_margin" },
            { t: "h", x: "Always present" },
            { t: "list", items: [
              "Runtime overhead: framework buffers, CUDA or Metal context, kernel workspaces, temporary activation tensors. Typically 1–2 GiB on a serving runtime, larger for production engines with persistent buffers.",
              "KV cache for the active context: incremental per token, formula above. Doubles when context doubles.",
              "Fragmentation reserve: free memory chopped into pieces too small to allocate against. A box reporting 4 GiB free may have eight 500 MiB holes — and a 3 GiB allocation will still fail. Paged-attention runtimes mitigate this; naive allocators do not."
            ]},
            { t: "h", x: "Workload-dependent" },
            { t: "list", items: [
              "Batch / concurrency: each in-flight request needs its own KV cache. Two simultaneous users at 8K context cost roughly the same as one user at 16K, all else equal.",
              "Vision encoder: multimodal models include an image encoder that consumes its own VRAM and produces tokens that feed into the language model's KV cache.",
              "Speculative draft model: speculative decoding requires loading a smaller draft model alongside the target model — small but not free.",
              "LoRA adapters: typically a few hundred megabytes per adapter, with the advantage that multiple adapters can be hot-swapped per request without reloading the base."
            ]},
            { t: "expand", x: "Un-pack — bytes per param, runtime overhead, fragmentation, LoRA, MoE, draft model", blocks: [
              { t: "defs", items: [
                { term: "bytes per param", def: "How much memory each weight takes. FP16 = 2, Q8 = 1, Q4 ≈ 0.5. Multiply by the parameter count (e.g. 13e9) to get weight memory." },
                { term: "runtime overhead", def: "Everything that isn't weights or cache: framework buffers, CUDA context, intermediate activation tensors, fragmentation. Usually 1–2 GiB on a serving runtime." },
                { term: "framework buffers", def: "Memory the runtime (PyTorch / llama.cpp / vLLM) allocates for its own bookkeeping — workspace for kernels, attention scratchpad, etc. Not the model itself." },
                { term: "fragmentation", def: "Free memory that's chopped into pieces too small to use. You may have \"4 GiB free\" but it's eight 500 MiB holes — a 3 GiB allocation still fails. Paged attention helps with this." },
                { term: "vision encoder", def: "The model component that turns an image into tokens (or vectors). Multimodal models have a vision encoder bolted on top of the text Transformer. It uses its own VRAM." },
                { term: "LoRA adapter", def: "A small set of extra weights (often a few hundred MB) that customizes a frozen base model. Multiple adapters can be loaded and switched per request — they barely add to VRAM." },
                { term: "MoE (Mixture of Experts)", def: "An architecture where each layer has many \"expert\" sub-networks, but only a few activate per token. Total params can be huge; compute and bandwidth per token are way less. Inactive experts still take memory." },
                { term: "active parameters", def: "The fraction of MoE params actually used for a given token. A 600B MoE might have 30B active per token — speed scales with active, capacity scales with total." },
                { term: "draft model", def: "The small fast model used in speculative decoding to propose tokens. Lives in memory alongside the real model — small but not free." }
              ]}
            ]},
            { t: "p", x: "Mixture-of-Experts models require a separate consideration. Total parameters drive capacity: the inactive experts still occupy memory at load time, since the router selects which experts activate per token at runtime. Active parameters drive per-token compute and bandwidth: a 600B-total / 30B-active MoE behaves like a 30B model in decode speed but consumes 600B-worth of VRAM. Expert-offloading techniques — keeping inactive experts in system RAM and paging them in on demand — can reduce the memory footprint at a substantial speed cost, but the default assumption is that the full expert set lives in VRAM." },
            { t: "p", x: "Two related notes affect how the math is applied. On unified-memory hardware (Apple Silicon, AMD Strix Halo, certain Intel SoCs) there is no separate VRAM pool: the same memory chips back both the CPU and the integrated GPU, and the entire system memory budget is available for model weights and KV cache subject to OS reservation. On discrete-GPU hardware the VRAM pool is fixed at purchase. When a model exceeds the available memory, most engines support CPU offloading — placing some weight layers in system RAM and streaming them across the PCIe bus per token — at a heavy speed penalty since system RAM bandwidth is an order of magnitude below VRAM bandwidth." },
            { t: "callout", x: "The same VRAM math predicts two related failure modes. A model that loads cleanly at short context can fail at long context because the KV cache term grew. A model that serves one user comfortably can fail under concurrency because the per-request KV cache multiplied across in-flight requests. Both are predictable from the layered budget. Leave 10–20% headroom for fragmentation, runtime variance, and surprise allocations." },
            { t: "widget", id: "vramCalc" }
          ],
          quiz: [
            { q: "A 13B Q4 model fits at 8K context but fails at 32K. Why?",
              a: ["The weights changed", "The KV cache grew with the longer context and exhausted memory", "The GPU got slower", "The vocabulary expanded"],
              c: 1,
              e: "The weights are fixed. KV cache scales with context tokens; 4× the context means roughly 4× the cache." },
            { q: "What's a reasonable headroom margin on VRAM?",
              a: ["0% — push right to the limit", "1–2%", "10–20%", "50% or more"],
              c: 2,
              e: "Running at 99% VRAM is begging for OOM and fragmentation crashes. Leave room for batching, overhead, and surprise allocations." },
            { q: "An MoE model has 600B total / 30B active parameters. What determines per-token compute cost?",
              a: ["Total parameters", "Active parameters", "The training dataset", "The number of users"],
              c: 1,
              e: "Speed scales with active params, capacity scales with total — but the inactive experts still take memory." },
            { q: "Why does Q4 sometimes need MORE headroom than Q8 at runtime?",
              a: ["Q4 has bigger weights", "Q4 has additional format overhead (lookup tables, group scales, etc.) and runtime dequant buffers", "Q4 is slower", "Q4 uses a different tokenizer"],
              c: 1,
              e: "The bytes-per-param number is the floor — quant formats add some bookkeeping memory on top." }
          ]
        },
        {
          id: "m3l3",
          title: "Memory Bandwidth",
          blocks: [
            { t: "p", x: "Memory bandwidth is the rate at which data moves from a device's memory chips into its compute units, measured in gigabytes per second. It is a property of the memory subsystem — the type of memory (HBM, GDDR6X, GDDR7, LPDDR5X, DDR5), the bus width, and the clock rate — not of the compute units themselves. The previous lesson covered whether a model fits in available memory; this lesson covers how fast that fitted model can run." },
            { t: "p", x: "Single-user decode is the canonical bandwidth-bound workload in local inference. Generating each output token requires a full forward pass through the model, and a full forward pass requires reading every active weight from memory through the compute units once. The KV cache for the active context must also be read. Compute on a modern GPU finishes the arithmetic faster than the memory subsystem can deliver the operands — the GPU spends most of its time waiting for data. Bandwidth, not compute throughput, governs how many tokens per second the system produces." },
            { t: "p", x: "A first-pass ceiling estimate, often called the roofline, is bandwidth ÷ bytes_per_forward_pass. For a 13B-parameter model in Q4 (roughly 6.5 GB of weights) on a GPU with 1 TB/s of memory bandwidth, the ceiling is 1000 GB/s ÷ 6.5 GB ≈ 154 tokens per second. Real-world rates fall below this ceiling because the KV cache, runtime overhead, and non-ideal kernels consume part of the bandwidth budget, but the ratio sets the upper bound that no amount of compute optimization can exceed on that hardware." },
            { t: "p", x: "Prefill is a different regime. Prefill processes the entire prompt in parallel as a single batched operation, which delivers high arithmetic intensity — the ratio of compute operations to bytes moved is large enough that the compute units, not the memory subsystem, become the bottleneck. This is why prefill scales with raw GPU FLOPs and is described as compute-bound, while decode scales with bandwidth and is described as memory-bound. Time-to-first-token (TTFT) is set by prefill; subsequent token rate is set by decode. A box can have fast TTFT and slow decode, or the reverse, depending on which side of the FLOPs-versus-bandwidth balance the hardware sits." },
            { t: "h", x: "The 2026 bandwidth landscape" },
            { t: "list", items: [
              "Server GPUs (NVIDIA H100 / H200 / B200, AMD MI300X / MI325X): 3–8 TB/s using HBM3 / HBM3e. The fastest decode hardware available; price reflects this.",
              "High-end consumer GPUs (RTX 4090, RTX 5090, RX 7900 XTX): 700 GB/s to 1.8 TB/s using GDDR6X or GDDR7. The sweet spot for serious individual local work.",
              "Mid-range consumer GPUs (RTX 4070 / 5070 class, RX 7800 XT): 400–700 GB/s. Workable for smaller models or aggressive quantization.",
              "Apple Silicon unified memory (M3 Pro / Max / Ultra, M4 Pro / Max): 200–800 GB/s using LPDDR5X. Strong capacity (up to 192 GB on M3 Ultra) at moderate bandwidth — fits very large models that no consumer GPU can hold, at slower token rates.",
              "Strix Halo and AI PCs: 200–500 GB/s using LPDDR5X. Similar capacity-over-bandwidth tradeoff to Apple Silicon, on x86.",
              "CPU-only (DDR5 server or desktop): 50–150 GB/s. An order of magnitude below GPU bandwidth — workable for very small models or development, prohibitive for serious decode speeds at meaningful model sizes."
            ]},
            { t: "h", x: "What memory bandwidth is not" },
            { t: "list", items: [
              "Compute throughput (FLOPs): how many arithmetic operations the GPU can do per second. Governs prefill speed and batch-mode throughput, not single-user decode.",
              "Interconnect bandwidth (PCIe, NVLink, Infinity Fabric): how fast data moves between the GPU and the host, or between multiple GPUs. Matters for CPU offloading and multi-GPU model sharding, but is unrelated to within-card decode speed when the model fits.",
              "Storage bandwidth (NVMe, SATA): how fast model weights load from disk into memory. Affects startup and model-swapping time, not inference speed once the model is resident.",
              "Memory capacity (VRAM in GB): how much model fits. Independent of how fast the fitted model runs."
            ]},
            { t: "p", x: "Quantization and Mixture-of-Experts both change the bytes-per-forward-pass term in the roofline. Halving the weight precision approximately halves the bytes streamed per token, approximately doubling the bandwidth-bound ceiling — which is why Q4 weights run faster than FP16 weights on the same hardware, in addition to fitting in less memory. MoE models stream only the experts the router activates for each token; a 600B-total / 30B-active MoE streams about 30B-worth of weights per token rather than 600B, decoding at roughly the speed of a 30B dense model while holding 600B-worth of capacity in memory. Both effects shift decode rate up by reducing the denominator of the roofline." },
            { t: "callout", x: "Capacity and bandwidth are two independent properties of a memory subsystem. Capacity decides whether a model fits. Bandwidth decides how fast it runs. A 192 GB unified-memory machine can hold models that no 32 GB discrete GPU can touch, while that same discrete GPU can outrun the unified-memory machine on any model that fits in 32 GB. Hardware selection is a match against the workload — the next lesson maps these two axes across the platforms practitioners actually encounter." }
          ],
          quiz: [
            { q: "Why is single-user decode described as memory-bandwidth-bound?",
              a: ["Because GPUs have small caches", "Because each output token requires streaming the active parameter set through compute once, and memory delivers data slower than compute consumes it", "Because LLMs are inherently slow", "Because the network is the bottleneck"],
              c: 1,
              e: "Decode produces one token per forward pass and a forward pass reads every active weight. With modern compute outpacing memory bandwidth, the GPU spends most decode time waiting for operands." },
            { q: "A model has 13B parameters in Q4 weights (~6.5 GB) and runs on a GPU with 1 TB/s memory bandwidth. The roofline ceiling decode rate is approximately…",
              a: ["~15 tokens/sec", "~150 tokens/sec", "~1500 tokens/sec", "~15000 tokens/sec"],
              c: 1,
              e: "1000 GB/s ÷ 6.5 GB ≈ 154 tokens/sec. Real-world rates fall below this because KV cache and runtime overhead also consume bandwidth, but the ceiling is set by this ratio." },
            { q: "Two GPUs have identical VRAM capacity. They can still produce very different decode rates because…",
              a: ["VRAM is the only thing that matters", "Memory bandwidth, not capacity, determines decode speed", "One is newer", "One has more cooling"],
              c: 1,
              e: "Capacity decides whether the model fits; bandwidth decides how fast it runs. They are independent axes of a memory subsystem." },
            { q: "Prefill is described as compute-bound rather than memory-bound because…",
              a: ["Prefill skips the model weights", "Prefill processes the entire prompt as a batched operation with high arithmetic intensity, making compute (not bandwidth) the bottleneck", "Prefill uses a different model", "Prefill is always fast"],
              c: 1,
              e: "Prefill batches the prompt tokens into parallel matrix multiplies — the ratio of compute to bytes moved is high enough that FLOPs, not memory bandwidth, limits speed." }
          ]
        },
        {
          id: "m3l4",
          title: "Hardware Tiers in Practice",
          blocks: [
            { t: "p", x: "The previous two lessons established what determines whether a model fits (capacity) and how fast a fitted model runs (bandwidth). This lesson maps that two-axis framing across the platforms practitioners actually encounter in 2026. Exact decode rates still depend on runtime, quantization, attention implementation, context length, and OS overhead — the tier mapping below is the first-pass orientation, not a benchmark prediction." },
            { t: "callout", x: "Local AI hardware is selected against three factors: capacity (whether the model fits), bandwidth (how fast it decodes), and the software stack (how much of the hardware's theoretical performance the runtime delivers). Spec sheets show the first two directly; the third becomes visible only under benchmarking." },
            { t: "p", x: "The most common mistake when comparing hardware is treating memory capacity as a proxy for AI performance. A 192 GB unified-memory machine and a 24 GB discrete GPU sit at different points on the capacity-bandwidth plane, and neither dominates the other across all workloads. The unified-memory machine wins when the model exceeds discrete-GPU capacity; the discrete GPU wins on any model that fits within its VRAM. Hardware choice is a match against the workload, not a single benchmark." },
            { t: "p", x: "The widget below summarizes the 2026 platform set with capacity and bandwidth side by side. The expandable reference that follows describes each tier in more detail." },
            { t: "widget", id: "bandwidthTiers" },
            { t: "expand", x: "Un-pack — Discrete GPU, Apple Silicon, DGX Spark, Strix Halo, AI PC, Tenstorrent", blocks: [
              { t: "defs", items: [
                { term: "NVIDIA discrete GPU", def: "The highest-bandwidth widely available consumer hardware. RTX PRO 6000 Blackwell ships 96 GB at 1.8 TB/s; RTX 5090 ships 32 GB at 1.8 TB/s; RTX 4090 sits at 24 GB and 1 TB/s. Strongest decode speeds when the model fits inside the available capacity." },
                { term: "AMD discrete GPU", def: "RX 7900 XTX (24 GB at 960 GB/s), Radeon PRO W7900 (48 GB at 864 GB/s), AI PRO R9700 (32 GB at 640 GB/s). Competitive bandwidth at lower price points; the ROCm software stack has narrower runtime coverage than CUDA, so engine compatibility should be checked before purchase." },
                { term: "Intel discrete GPU", def: "Arc Pro B65 (32 GB at ~608 GB/s), Arc Pro B60 (24 GB at ~456 GB/s). A rising alternative when the chosen runtime supports the SYCL or OpenVINO path." },
                { term: "Apple Mac Studio Ultra", def: "Up to 512 GB unified memory at 819 GB/s. The leading one-box option for very large models that no consumer discrete GPU can hold. Decode speed and concurrency are lower than a discrete GPU on models that fit in discrete VRAM; the value proposition is capacity, not raw throughput." },
                { term: "Apple Mac / MBP Max", def: "M4 / M5 Max class: 460–614 GB/s with 64–128 GB. A workstation-tier portable option for individual workflows." },
                { term: "DGX Spark", def: "128 GB coherent unified memory at 273 GB/s with the NVIDIA software stack and NVFP4 support. A developer appliance positioned for CUDA-native experimentation at high capacity, not for raw decode throughput." },
                { term: "Strix Halo / Ryzen AI Max", def: "An x86 unified-memory platform. 256-bit LPDDR5X, up to 128 GB total memory, ~256 GB/s bandwidth, with up to ~96 GB usable by the integrated GPU. Framework Desktop is an early system shipping this platform." },
                { term: "AI PC (thin-and-light)", def: "Snapdragon X Elite (~135 GB/s), Intel Lunar Lake (~136 GB/s), MacBook Air M5 (~153 GB/s), Snapdragon X2 Elite (~152–228 GB/s). Suitable for small assistants, dictation, and on-device edge workloads. Bandwidth sits well below workstation class, and model size expectations should be calibrated to the smaller tier." },
                { term: "Tenstorrent", def: "Wormhole n300 (24 GB at 576 GB/s), Blackhole p150 (32 GB at 512 GB/s with 800 G interconnect). Fully open-source software stack; relevance grows as the toolchain matures." }
              ]}
            ]},
            { t: "h", x: "Practical capacity tiers" },
            { t: "list", items: [
              "12–16 GB VRAM — entry tier. Comfortably runs 7B-class models at moderate context with Q4 weights. Suitable for chat, light coding, and single-document RAG.",
              "24 GB VRAM — enthusiast sweet spot. Adds 13–14B models at usable context, or 7B at long context with light concurrency. The best capacity-per-dollar tier for serious individual work in 2026.",
              "48 GB and above (discrete or unified) — serious tier. Adds 30–70B models, multi-document RAG, larger batches, and longer contexts. Unified-memory systems (Apple, Strix Halo) become viable candidates here for capacity-bound workloads, with the bandwidth tradeoff covered above."
            ]},
            { t: "callout", x: "When a model exceeds available VRAM, most engines support spilling layers to system RAM and streaming them across the PCIe bus per token. Decode speed drops by roughly the ratio of GPU bandwidth to PCIe bandwidth — often an order of magnitude or more. CPU offload is a usable escape valve for experimentation and one-off jobs, not a viable strategy for any workflow that values response time. If a model only barely fits with offload, a smaller or more aggressively quantized model is almost always the better choice." }
          ],
          quiz: [
            { q: "What is single-user decode usually limited by?",
              a: ["GPU FLOPs", "Memory bandwidth", "VRAM capacity", "The OS scheduler"],
              c: 1,
              e: "Decode streams the model's weights every single token. Bandwidth — not raw compute — is the bottleneck." },
            { q: "For 2026 local users, what's described as the minimum comfortable GPU tier?",
              a: ["8 GB", "12 GB", "16 GB", "48 GB"],
              c: 2,
              e: "16 GB is the minimum comfortable tier; 24 GB is the best-value enthusiast tier; 48 GB+ opens the stronger local world." },
            { q: "The most painful local setup is…",
              a: ["One that's too fast", "One that almost fits and spills layers to CPU", "One with too much VRAM", "One that's fully offline"],
              c: 1,
              e: "CPU offload technically runs but token speed collapses — acceptable for experimentation, never as a performance strategy." }
          ]
        },
        {
          id: "m3l5",
          title: "What Controls Speed",
          blocks: [
            { t: "p", x: "Tokens per second is not governed by any single property of the hardware or the model. It is the product of memory bandwidth, compute throughput, capacity-with-or-without-offload, attention implementation, quantization, batching strategy, context length, generated length, and runtime maturity. This lesson collects the levers that determine realized speed and groups them by which workloads each lever dominates — a diagnostic frame more useful than a flat checklist when reasoning about a specific stack." },
            { t: "h", x: "The principal levers" },
            { t: "list", items: [
              "Memory bandwidth — the rate at which weights stream from memory to compute. Dominates single-user decode token rate.",
              "GPU FLOPs — raw compute throughput. Dominates prefill speed and large-batch decode.",
              "VRAM capacity — sets which models load at all. Becomes a speed factor the moment a model spills layers to CPU offload, where decode collapses by roughly an order of magnitude.",
              "Attention implementation — FlashAttention, SDPA variants, paged attention, and similar kernels change both speed and memory cost per token.",
              "Quantization — lower-precision weights move fewer bytes per forward pass, raising the bandwidth-bound ceiling at some quality cost.",
              "Batch size and concurrency — batching amortizes weight reads across many requests and shifts decode toward compute-bound, but each in-flight sequence requires its own KV cache.",
              "Prompt length — long prompts inflate prefill, which sets time-to-first-token.",
              "Generated length — long responses expose sustained decode speed across many tokens.",
              "Speculative decoding — EAGLE-style methods, multi-token prediction, and tree-based variants verify more than one drafted token per forward pass, increasing effective tokens per second when the draft is accurate.",
              "Scheduler and runtime quality — paged attention, continuous batching, prefix caching, and chunked prefill all affect how close to the theoretical ceiling the runtime actually delivers."
            ]},
            { t: "h", x: "Which lever dominates which workload" },
            { t: "list", items: [
              "Single-user chat (short prompts, moderate responses): memory bandwidth is the dominant lever. Quantization helps by reducing the bytes streamed per token.",
              "Single-user long-prompt one-shot (summarization, document Q&A on a large input): prefill compute dominates time-to-first-token; bandwidth dominates the response stream that follows.",
              "Multi-user serving (concurrent requests): batching strategy and scheduler quality dominate, with compute and KV-cache capacity setting the achievable concurrency.",
              "Coding assistants and tool-use loops: TTFT matters more than sustained decode rate, because each turn is a fresh prefill. Prefill compute and prefix caching dominate the perceived responsiveness.",
              "Agent loops with many short tool-calling steps: per-step latency (TTFT + short decode) dominates over throughput. Speculative decoding can be a meaningful lever here."
            ]},
            { t: "callout", x: "Leaderboard numbers and spec-sheet ceilings rarely match realized tokens-per-second on a specific stack. The credible benchmark is one run on the exact runtime, quantization, context length, prompt shape, and concurrency that the deployment will actually see. Measure the workload, not the abstraction." },
            { t: "widget", id: "speedPredictor" }
          ],
          quiz: [
            { q: "For a single-user chat, which factor most directly affects tokens-per-second during decode?",
              a: ["GPU FLOPs", "Memory bandwidth", "VRAM capacity", "Network speed"],
              c: 1,
              e: "Decode streams weights every step — bandwidth is the dominant lever." },
            { q: "Long prompts mainly hurt which phase?",
              a: ["Decode", "Prefill", "Tokenization", "Quantization"],
              c: 1,
              e: "The model must process every token of the prompt before producing the first output token — that's prefill." },
            { q: "Speculative decoding speeds things up by…",
              a: ["Increasing the model's parameter count", "Having a draft model propose multiple tokens that the target verifies in one pass", "Skipping safety checks", "Reducing memory bandwidth"],
              c: 1,
              e: "Cheap draft + one big verify ≈ multiple tokens per forward pass. Big win when the draft is good." },
            { q: "Two GPUs have the same VRAM. They can still have very different token speeds because…",
              a: ["VRAM is the only thing that matters", "One has higher memory bandwidth than the other", "One is a different color", "One has more cooling"],
              c: 1,
              e: "Same capacity, different bandwidth = different token rates. Capacity controls what fits; bandwidth controls how fast." }
          ]
        }
      ]
    },

    {
      id: "m4",
      title: "Software Stack",
      summary: "The runtime layer: the inference engine landscape and how to choose one, a hands-on walkthrough of standing up the first local server, and the serving modes that come into play beyond a single user.",
      lessons: [
        {
          id: "m4l1",
          title: "Runtimes and Choosing an Engine",
          blocks: [
            { t: "p", x: "An inference engine is the software layer that loads model weights into hardware memory, schedules forward passes against incoming requests, manages the KV cache, and exposes an API to the calling application. The engine sits between the model file on disk and the consuming code, and its choice determines what model formats are accepted, what hardware is supported, what concurrency is achievable, and what API surface the application sees. Module 1 covered what a forward pass is; this lesson covers the software responsible for actually running them." },
            { t: "p", x: "An engine's responsibilities include reading and dequantizing weights, allocating KV cache memory, dispatching attention and matrix-multiplication kernels appropriate to the target accelerator, batching concurrent requests, applying sampling parameters, and serving the result through an HTTP, gRPC, or in-process API. The same model file can produce very different latency, throughput, and stability depending on which engine runs it — engine quality is a meaningful multiplier on hardware quality." },
            { t: "callout", x: "Engines split into four families: portable local runtimes (llama.cpp, MLC, ONNX Runtime GenAI, OpenVINO), Apple unified-memory runtimes (MLX / MLX-LM), consumer CUDA quantization engines (ExLlamaV2 / V3), and production serving engines (vLLM, SGLang, TensorRT-LLM, TGI, LMDeploy). Orchestration layers such as NVIDIA Dynamo sit above the serving engines. Each family is optimized for a different combination of hardware, model size, concurrency, and operational maturity." },
            { t: "p", x: "Quick-start guidance by operator profile: for an individual experimenting on a single machine, LM Studio (graphical, GGUF-based) or llama.cpp (command-line, portable) is the lowest-friction path; on Apple Silicon, MLX-LM additionally takes advantage of unified memory. For an enthusiast running 2–4 consumer GPUs and pushing local performance, ExLlamaV2 or ExLlamaV3 via TabbyAPI is the frontier. For a team standing up a private OpenAI-compatible service, vLLM or SGLang are the production defaults. For maximum throughput on dedicated NVIDIA infrastructure, TensorRT-LLM compiles a model-specific engine. For browser or mobile deployment, MLC LLM or WebLLM ships the model into the user's device. The widget below narrows the choice further." },
            { t: "widget", id: "enginePicker" },
            { t: "expand", x: "Un-pack — engines to know in 2026", blocks: [
              { t: "defs", items: [
                { term: "llama.cpp", def: "C++ engine focused on portability. Runs on CPU (AVX / AVX2 / AVX-512 / AMX), Apple Silicon (Metal), NVIDIA (CUDA), AMD (HIP / Vulkan), Intel (SYCL), and other ISAs including RISC-V. Uses GGUF format. The bundled llama-server supports OpenAI and Anthropic API surfaces, function calling, JSON schemas, and multimodal inputs. Not designed for multi-node production serving — the RPC backend is documented as proof-of-concept — and multi-GPU support is limited." },
                { term: "MLX / MLX-LM", def: "Apple's array framework and LLM package, built around the unified-memory architecture of Apple Silicon. CPU and GPU share the same memory pool, allowing larger quantized models than a typical discrete consumer GPU can hold. MLX-LM provides Hugging Face integration, quantization, LoRA, and distributed inference. The bundled server is documented as not production-grade." },
                { term: "ExLlamaV2", def: "CUDA-focused engine optimized for single-GPU consumer hardware. Supports EXL2 quantization, paged attention, dynamic batching, prompt caching, KV deduplication, and speculative decoding. Targets maximum single-GPU performance rather than multi-user serving." },
                { term: "ExLlamaV3", def: "Multi-GPU successor to ExLlamaV2. Adds the EXL3 quantization format (based on QTIP), tensor-parallel and expert-parallel inference for consumer hardware, and OpenAI-compatible serving via the TabbyAPI front-end. The current frontier for 2–4 RTX local setups and consumer-hardware MoE serving. Coverage of newer model architectures lags behind upstream releases." },
                { term: "Harbor", def: "An orchestration toolkit that wires together a full local AI stack — frontend, backends (llama.cpp / vLLM / SGLang / etc.), embeddings, RAG, and vector database — through a single command. Suited to operators who want a complete local stack with minimal manual configuration." },
                { term: "LM Studio", def: "Desktop application available on Mac, Windows, and Linux. Provides graphical model browsing and download, in-app chat, and an OpenAI-compatible API server. Built on llama.cpp under the hood; uses GGUF format. The shortest path to a working local API for non-developers." },
                { term: "vLLM", def: "The default open-source production server. Features PagedAttention for KV memory management, continuous batching, chunked prefill, prefix caching, broad quantization support (FP8, MXFP4, NVFP4, INT8, GPTQ, AWQ, GGUF), tensor/pipeline/data/expert/context parallelism, OpenAI and Anthropic API surfaces, multi-LoRA serving, and backends for NVIDIA, AMD, Intel, TPU, Gaudi, and Apple. Production deployment still requires tuning batching, parallelism layout, and request routing." },
                { term: "SGLang", def: "A serving engine focused on demanding workloads. Provides RadixAttention prefix caching, prefill-decode disaggregation, tensor/pipeline/expert/data parallelism, speculative decoding, structured-output generation, and multi-LoRA batching. Often the right choice for long-context serving, MoE models, complex routing, and high-throughput structured outputs." },
                { term: "TensorRT-LLM", def: "NVIDIA's optimization stack for maximum throughput on NVIDIA hardware. Compiles model-specific TensorRT engines with custom attention, GEMM, and MoE kernels, prefill-decode disaggregation, Wide Expert Parallelism, and speculative decoding. Supports FP8 on H100-class and FP4 on B200-class hardware with native kernels. Highly optimized but tied to NVIDIA — not portable across accelerator vendors." },
                { term: "TGI", def: "Hugging Face's production server. Provides tracing, metrics, tensor parallelism, and continuous batching. Suited to environments where Hugging Face integration is already in use." },
                { term: "MLC LLM", def: "Compiler-first deployment framework. Exposes OpenAI-compatible APIs across REST, Python, JavaScript, iOS, and Android targets. Suited to applications shipped to many platforms, particularly browser (via WebLLM) and mobile." },
                { term: "ONNX Runtime GenAI", def: "Generative-loop layer on top of ONNX Runtime, used by Foundry Local, Windows ML, and the VS Code AI Toolkit. Supports CPU, CUDA, DirectML, TensorRT-RTX, OpenVINO, QNN, WebGPU, and AMD GPU backends. Suited to application deployment and ONNX-format workflows." },
                { term: "OpenVINO GenAI", def: "Intel's optimization stack for Xeon CPUs, Arc GPUs, Core Ultra processors, and NPUs. Exposes an OpenAI-compatible server with continuous batching and paged attention." },
                { term: "LMDeploy", def: "CUDA-focused toolkit combining TurboMind (performance-oriented runtime) and a PyTorch runtime (compatibility-oriented). An alternative to vLLM / SGLang / TensorRT-LLM for CUDA-only deployments." },
                { term: "NVIDIA Dynamo", def: "Distributed orchestration layer that sits above serving engines (vLLM, SGLang, TensorRT-LLM). Provides disaggregated prefill and decode, KV-aware request routing, multi-tier KV caching, and autoscaling. Applicable when a single engine instance is no longer sufficient." },
                { term: "prefill-decode disaggregation", def: "Architectural pattern separating compute-intensive prefill from memory-intensive decode into specialized instances, transferring KV cache between them. Prevents long prefill batches from interrupting decode and inflating token latency. Implemented in SGLang, TensorRT-LLM, and Dynamo." },
                { term: "WebLLM", def: "Browser-native runtime built on MLC LLM. Runs models entirely in the user's browser using WebGPU, requiring no server and no API key." }
              ]}
            ]},
            { t: "callout", x: "Ollama is a convenience wrapper around llama.cpp that provides one-line model pulls and a simplified CLI. It abstracts away runtime flags that other engines expose directly, which trades tuning control for setup ease. For finer-grained control over llama.cpp's behavior, invoke llama.cpp directly; for a graphical equivalent, use LM Studio; on Apple Silicon, MLX-LM is the unified-memory-native choice; for multi-user serving, vLLM or SGLang." },
            { t: "callout", x: "Engine choice usually determines which model file format the operator must download. llama.cpp and its derivatives consume GGUF; vLLM and SGLang consume safetensors; TensorRT-LLM consumes ONNX or compiled TensorRT engines; ExLlama consumes EXL2 / EXL3; MLX consumes its own quantized format. The practical workflow is to choose the engine first based on hardware and workload, then locate the model in the format the engine expects." }
          ],
          quiz: [
            { q: "For a single person experimenting on a laptop, the simplest starting point is…",
              a: ["TensorRT-LLM", "vLLM", "LM Studio or Harbor", "Writing a custom CUDA kernel"],
              c: 2,
              e: "Start with a desktop-first runtime. Move to vLLM / SGLang when you need a real API or concurrency." },
            { q: "For serving many concurrent users with high throughput, which is most appropriate?",
              a: ["llama.cpp single-thread", "LM Studio desktop", "vLLM or SGLang", "WebLLM in a browser"],
              c: 2,
              e: "These are built for concurrency, batching, and high throughput — the right tier for serving real traffic." },
            { q: "Your runtime choice usually determines…",
              a: ["The model's vocabulary", "The model file format you'll need", "The user's API key", "The chat template"],
              c: 1,
              e: "llama.cpp wants GGUF, vLLM/SGLang want safetensors, TensorRT-LLM wants compiled engines. Pick runtime first, then find the model in the right format." }
          ]
        },
        {
          id: "m4l2",
          title: "Your First Local Server",
          blocks: [
            { t: "p", x: "The preceding lessons have been conceptual. This lesson is hands-on: standing up a working local OpenAI-compatible server, sending it a request, and verifying the response. The runtime selected for the walkthrough is LM Studio because it provides the shortest path from a fresh install to a running endpoint, but the request and response shapes shown here are the OpenAI Chat Completions schema and apply unchanged to any compatible engine — Ollama, the bundled llama-server, vLLM, SGLang, and others all speak the same API surface." },
            { t: "p", x: "The workflow has four steps: install the runtime, download a model in the correct format, start the server, and send the first request. Each step is described below with the specific actions for LM Studio." },
            { t: "h", x: "Step 1 — Install the runtime" },
            { t: "p", x: "Download LM Studio from lmstudio.ai for the operating system in use (macOS, Windows, or Linux) and complete the installer. On first launch the application prompts to select a model from its catalog; this can be skipped — the model can be chosen explicitly in the next step." },
            { t: "h", x: "Step 2 — Download a model" },
            { t: "p", x: "Open the Discover tab and search for a small instruction-tuned model in GGUF format. A good first choice on most hardware is a 7B-class Q4_K_M quantization — small enough to fit on any GPU with at least 8 GB of VRAM, and high enough quality for meaningful conversation. Common examples include Llama 3.x 8B Instruct, Qwen 2.5 7B Instruct, and Mistral 7B Instruct, each available from their official publishers on the LM Studio catalog. Click the download button; the model file (typically 4–5 GB at Q4) will be saved to LM Studio's models directory." },
            { t: "h", x: "Step 3 — Load the model and start the server" },
            { t: "p", x: "Open the Developer tab. Select the downloaded model from the model picker at the top of the window; LM Studio loads the weights into memory. Once the model status indicator shows it is loaded, click Start Server. The server listens on http://localhost:1234 by default, with the OpenAI-compatible endpoints under /v1/. The Developer tab also displays the loaded model's identifier — that identifier is what the request body's model field must reference." },
            { t: "h", x: "Step 4 — Send the first request" },
            { t: "p", x: "From any terminal, the smallest meaningful request is a chat completion. The model identifier in the example below should be replaced with the identifier shown in LM Studio's Developer tab." },
            { t: "code", x: "curl http://localhost:1234/v1/chat/completions \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"model\": \"local-model-identifier\",\n    \"messages\": [\n      {\"role\": \"system\", \"content\": \"You are a concise assistant.\"},\n      {\"role\": \"user\", \"content\": \"Reply with the single word: ready\"}\n    ],\n    \"temperature\": 0\n  }'" },
            { t: "p", x: "A successful response is a JSON object containing a choices array, with the model's reply in choices[0].message.content. The full response schema matches OpenAI's documented Chat Completions format, including the role and content fields, the finish_reason, and per-call token usage." },
            { t: "h", x: "Step 5 — Send the same request from JavaScript" },
            { t: "p", x: "The same endpoint accepts requests from any HTTP client. The example below uses Node's built-in fetch, but the pattern is identical in a browser script once CORS is enabled (see below)." },
            { t: "code", x: "const response = await fetch('http://localhost:1234/v1/chat/completions', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    model: 'local-model-identifier',\n    messages: [\n      { role: 'system', content: 'You are a concise assistant.' },\n      { role: 'user', content: 'Reply with the single word: ready' }\n    ],\n    temperature: 0\n  })\n});\nconst data = await response.json();\nconsole.log(data.choices[0].message.content);" },
            { t: "callout", x: "The request and response shapes are the OpenAI Chat Completions API. The same client code works against any compatible engine — switching from LM Studio to Ollama, llama-server, vLLM, or a cloud OpenAI endpoint requires only changing the base URL and (for cloud providers) adding an API key. The portability of the OpenAI surface is the reason it has become the de facto standard for local serving." },
            { t: "h", x: "Enabling CORS for browser apps" },
            { t: "p", x: "Browsers block cross-origin requests by default. A web application served from a different origin (for example, a static site on a different port) cannot call the LM Studio server until cross-origin resource sharing is enabled on the server. In LM Studio, the Developer tab includes a Settings panel with a toggle for Enable CORS — switching it on adds the Access-Control-Allow-Origin header to responses, permitting browser-based clients to connect. Other runtimes expose this differently: Ollama uses the OLLAMA_ORIGINS environment variable; llama-server uses the --cors flag; production engines such as vLLM typically have CORS configured at the reverse-proxy layer." },
            { t: "h", x: "Common failure modes" },
            { t: "list", items: [
              "Connection refused — the server is not running. Confirm Start Server was clicked in the Developer tab and that the model finished loading before the request was sent.",
              "404 on /v1/chat/completions — the wrong port or path was used. LM Studio defaults to port 1234; the chat-completions endpoint is /v1/chat/completions. The Developer tab displays the active port.",
              "Model not loaded error — a request was sent before LM Studio finished loading the model into memory. Wait for the loaded indicator before sending requests, especially for larger models.",
              "Empty or nonsensical response — the model identifier in the request body did not match the loaded model. Copy the identifier directly from the Developer tab.",
              "CORS error in browser console — the request originated from a browser and CORS is not enabled. Enable CORS in the Developer tab's settings panel.",
              "Slow first token, then fast tokens — expected behavior. The first request triggers prefill across the system prompt; subsequent tokens decode at the system's steady-state rate (see m1l6 and m3l3)."
            ]},
            { t: "callout", x: "The chat panel on this site (accessible from the Chat tab in the header) is itself a working consumer of a local OpenAI-compatible server. Once the server above is running, opening the chat panel and pointing it at http://localhost:1234 will produce live conversation against the loaded model, demonstrating the same client pattern this lesson describes." }
          ],
          quiz: [
            { q: "Which API surface does LM Studio's local server expose?",
              a: ["A custom LM Studio API", "The Anthropic Messages API", "The OpenAI Chat Completions API", "GraphQL"],
              c: 2,
              e: "LM Studio exposes OpenAI-compatible endpoints on /v1/, which is the de facto standard for local serving — Ollama, llama-server, vLLM, and others all expose the same surface." },
            { q: "A browser application calling localhost:1234 from a different origin fails with a CORS error. The fix is to…",
              a: ["Restart the browser", "Enable CORS in LM Studio's Developer tab settings", "Disable the model", "Change the request to GET instead of POST"],
              c: 1,
              e: "Browsers block cross-origin requests by default. The server must add the Access-Control-Allow-Origin header — in LM Studio this is a toggle in the Developer tab." },
            { q: "After switching from LM Studio to a different OpenAI-compatible engine (Ollama, vLLM, etc.), what changes in the client code?",
              a: ["The entire client must be rewritten", "Only the base URL (and possibly the API key for cloud endpoints)", "The request format changes completely", "The response format changes completely"],
              c: 1,
              e: "The OpenAI Chat Completions schema is the same across all compatible engines. Only the base URL and authentication need to change." },
            { q: "A chat completion request returns immediately with an empty or unrelated reply. The most likely cause is…",
              a: ["The hardware is too slow", "The model identifier in the request did not match the loaded model", "The Content-Type header was wrong", "The temperature was too low"],
              c: 1,
              e: "If the model field doesn't match what's loaded, the server may route to a default or empty handler. Copy the exact identifier from the Developer tab." }
          ]
        },
        {
          id: "m4l3",
          title: "Production Serving Modes",
          blocks: [
            { t: "p", x: "Local serving complexity grows with concurrency. A single-user setup needs little beyond a loaded engine; a team-shared endpoint introduces request management and visibility concerns; a production deployment introduces a body of techniques aimed at keeping latency and throughput acceptable as concurrent load rises. The previous lesson established the single-user pattern. This lesson covers what changes when more than one consumer is served at once, and which production techniques exist to keep that change tractable." },
            { t: "h", x: "Three practical serving modes" },
            { t: "list", items: [
              "Single-user local: a desktop app, CLI, or local server consumed by one person. Iteration is the priority — comparing models, prompt formats, speed, and memory use without operational overhead.",
              "Team or private API: an OpenAI-compatible endpoint shared across a small group. Operational concerns appear: monitoring, prompt and version management, request routing, and realistic latency measurements under real workloads.",
              "Production serving: a public or high-traffic endpoint. Continuous batching, prefix caching, paged attention, speculative decoding, prefill-decode disaggregation, tensor and pipeline parallelism, quantized serving, structured-output enforcement, load balancing, latency percentile tracking, and failover all become relevant — selected based on the workload."
            ]},
            { t: "h", x: "When to graduate between modes" },
            { t: "list", items: [
              "From single-user to team-API: when a second person needs access, when prompts and versions need to be tracked, when usage exceeds what one operator can monitor informally, or when the model needs to be accessible from machines other than the one running the engine.",
              "From team-API to production: when concurrent request volume exceeds what a single engine instance handles comfortably, when latency tail (p95 / p99) begins to violate user expectations, when uptime needs to survive a single-machine failure, or when cost-per-request begins to matter and tuning becomes worth the engineering investment.",
              "Premature graduation: standing up vLLM with tensor parallelism for a workload that two people will use is an operational tax with no return. Match the mode to the actual concurrency, not the imagined one."
            ]},
            { t: "h", x: "Production techniques and the bottlenecks they address" },
            { t: "list", items: [
              "Continuous batching addresses GPU idle time between requests. Static batching waits for a full batch to assemble before processing; continuous batching slots new requests into a running batch whenever a sequence completes, keeping the GPU saturated under variable load.",
              "Prefix caching addresses repeated prefill cost. Chat applications send the same long system prompt with every turn, and many requests share opening conversation history. Caching the KV state for shared prefixes skips the recomputation and reduces both TTFT and total compute.",
              "Paged attention addresses KV cache fragmentation. Without paging, the KV cache for each sequence requires a contiguous allocation, and freeing finished sequences leaves fragmented holes that limit concurrency. Paging the KV cache into fixed-size blocks (analogous to OS virtual memory) lets the engine pack many concurrent sequences into the same GPU memory.",
              "Speculative decoding addresses single-stream decode latency. A small draft model proposes several tokens, which the target model verifies in a single forward pass. When the draft is accurate, the target produces multiple tokens per forward pass, raising effective decode rate substantially.",
              "Prefill-decode disaggregation addresses tail latency under mixed workloads. A long prefill batch on the same GPU as ongoing decode requests will stall those decodes, spiking p99 latency. Routing prefill to specialized instances and transferring the resulting KV cache to decode instances prevents that interference.",
              "Tensor and pipeline parallelism address single-GPU capacity limits. Tensor parallelism splits each layer's matrix multiplications across multiple GPUs that participate in the same forward pass; pipeline parallelism places different layers on different GPUs with tokens flowing through. Both let models exceed one GPU's VRAM at the cost of additional interconnect traffic.",
              "Latency percentiles address the inadequacy of averages. Tracking p50 / p95 / p99 reveals the experience of slowest users, which an average-latency dashboard hides. A workload with an acceptable mean but a poor p99 is failing for a measurable fraction of requests."
            ]},
            { t: "callout", x: "Production serving requires observability beyond the inference engine itself: per-request latency percentiles, error rates by category (OOM, timeout, model error, malformed request), GPU utilization and memory pressure, queue depth and wait time, and cost-per-token or cost-per-request. An engine in production with no monitoring is opaque the moment it begins to fail under load." },
            { t: "expand", x: "Un-pack — continuous batching, prefix caching, paged attention, parallelism, percentiles", blocks: [
              { t: "defs", items: [
                { term: "continuous batching", def: "A scheduling pattern in which the server adds new requests to the running batch the moment a slot opens, rather than waiting for a fixed batch to assemble. Maintains GPU utilization under variable arrival rates and substantially raises throughput on serving engines." },
                { term: "prefix caching", def: "Reuse of the previously computed KV cache for a shared opening (such as a long system prompt or a multi-turn conversation history) across multiple requests. Eliminates redundant prefill work and lowers time-to-first-token for cache hits." },
                { term: "paged attention", def: "KV cache memory management organized into fixed-size pages, analogous to virtual memory in an operating system. Prevents fragmentation and allows the engine to pack many concurrent sequences into a single GPU's memory. Originally introduced by vLLM." },
                { term: "speculative decoding", def: "A decode-acceleration technique in which a small fast draft model proposes several tokens and the target model verifies them in a single forward pass. When draft accuracy is high, the target produces multiple accepted tokens per pass, raising effective tokens-per-second." },
                { term: "prefill-decode disaggregation", def: "Architectural pattern that separates compute-intensive prefill from memory-intensive decode into specialized instances, transferring KV cache between them. Prevents long prefill batches from stalling concurrent decode streams. Used by SGLang, TensorRT-LLM, and NVIDIA Dynamo." },
                { term: "tensor parallelism", def: "Parallelism strategy in which each layer's matrix multiplications are partitioned across multiple GPUs that all participate in the same forward pass. Allows a model to exceed one GPU's VRAM at the cost of additional NVLink or PCIe traffic per layer." },
                { term: "pipeline parallelism", def: "Parallelism strategy in which different GPUs hold different contiguous ranges of the model's layers, with tokens flowing through the pipeline. Allows large models to be served across multiple GPUs with relatively low per-GPU communication cost but introduces bubble overhead at low batch sizes." },
                { term: "latency percentiles", def: "p50, p95, and p99 denote the median, 95th-percentile, and 99th-percentile response times in a sample. Percentiles surface tail latency that average-based metrics hide and are the standard way to report serving performance." }
              ]}
            ]}
          ],
          quiz: [
            { q: "Continuous batching differs from static batching by…",
              a: ["Batching tokens instead of requests", "Running multiple model copies in parallel", "Slotting new requests into the running batch the moment a sequence completes, rather than waiting for a fixed batch to assemble", "Disabling batching entirely"],
              c: 2,
              e: "Continuous batching maintains GPU utilization under variable arrival rates by adding requests dynamically." },
            { q: "Prefix caching helps most in workloads where…",
              a: ["Every request has unique text from the first token", "Requests share long common openings such as a system prompt or conversation history", "Requests are very short", "The model is small"],
              c: 1,
              e: "Prefix caching reuses already-computed KV state for shared opening tokens, skipping redundant prefill — chat applications and tool-use loops benefit substantially." },
            { q: "A serving workload has an acceptable mean latency but poor p99 latency. The right interpretation is…",
              a: ["The system is healthy because the average is acceptable", "A measurable fraction of users are seeing failing or very slow responses, which the mean hides", "Mean and p99 always agree", "p99 is irrelevant to serving"],
              c: 1,
              e: "Averages hide tail behavior. Percentiles are the standard because users experience individual requests, not averages." },
            { q: "Tensor parallelism and pipeline parallelism are both used to…",
              a: ["Train a model faster", "Serve a model that exceeds the VRAM of any single GPU, by splitting it across multiple GPUs", "Quantize the model", "Avoid using the KV cache"],
              c: 1,
              e: "Both partition the model across GPUs — tensor parallelism splits each layer's math, pipeline parallelism splits across layer ranges. Both add interconnect cost in exchange for capacity." }
          ]
        }
      ]
    },

    {
      id: "m5",
      title: "Applications",
      summary: "Putting a deployed model to work: long context techniques, multimodality, RAG, document and knowledge workflows, coding integration, agents with guardrails, and fine-tuning.",
      lessons: [
        {
          id: "m5l1",
          title: "Long Context",
          blocks: [
            { t: "p", x: "Long-context windows of 128K, 256K, and 1M tokens are now standard on many local-runnable models. Accepting more tokens is not free: KV cache memory scales linearly with context (see the VRAM math lesson in Module 3), prefill compute grows with prompt length, and attention quality can degrade across distance. A model that handles the closing pages of a long document well may miss details placed near the beginning — the so-called lost-in-the-middle pattern — even though the tokens are nominally within the window." },
            { t: "p", x: "The natural use cases for long context are whole-document analysis, slicing through a codebase in a single pass, legal or technical review, transcript summarization, multi-file reasoning, and RAG fallback for retrieval misses. The cost-quality tradeoff means long context is a tool, not a default: short prompts with retrieved evidence often outperform long prompts that dump entire corpora into the window." },
            { t: "callout", x: "Long context is a complement to retrieval, not a replacement. Retrieval (covered later in this module) narrows a large corpus to relevant evidence; long context holds the narrowed evidence — plus instructions, conversation history, and structure — at the model's working scale." },
            { t: "h", x: "Practical habits" },
            { t: "list", items: [
              "Place critical instructions near the beginning and end of the prompt, where attention is strongest.",
              "Use clear section headers and delimiters to mark document boundaries.",
              "Request citations tied to specific source chunks so the answer is auditable.",
              "Compress irrelevant conversation history rather than feeding the full transcript.",
              "Use summary memory or rolling summaries instead of unbounded chat history."
            ]},
            { t: "widget", id: "longContextHabits" }
          ],
          quiz: [
            { q: "A model advertises a 128K context window. What can you safely assume?",
              a: ["It runs equally fast at 1K and 100K", "It stays equally accurate across the whole window", "It can technically accept up to 128K, but speed and accuracy may degrade well before that", "It runs with no extra memory cost"],
              c: 2,
              e: "Supported length is a ceiling, not a guarantee. Test the lengths you actually use." },
            { q: "Long context is best treated as…",
              a: ["A replacement for retrieval", "A complement to retrieval — RAG for large corpora, long context for the final selected evidence", "Always cheaper than RAG", "Always more accurate than RAG"],
              c: 1,
              e: "RAG narrows the corpus; long context holds the narrowed evidence. They're complementary." },
            { q: "A practical habit for long-context prompts:",
              a: ["Bury critical instructions in the middle", "Skip section headers", "Put critical instructions near the beginning AND end, use delimiters, ask for citations", "Always include the longest possible history"],
              c: 2,
              e: "Models often attend best to the start and end. Help them by structuring the prompt and demanding citations." }
          ]
        },
        {
          id: "m5l2",
          title: "Multimodality",
          blocks: [
            { t: "p", x: "Multimodal models accept images and, in some cases, audio or video in addition to text. The mechanism in current vision-language models is patch tokenization: the image is divided into a grid of small patches (commonly 14×14 or 16×16 pixels), and a vision encoder converts each patch into a vector that occupies one slot in the model's context — token-equivalent in both memory and attention cost, even though no human-readable token text exists." },
            { t: "p", x: "The practical consequence is that non-text inputs draw from the same context budget as text. A single high-resolution image can contribute thousands of patch tokens; audio segments and video frames multiply the count further. Vision encoders also add their own VRAM footprint (see the VRAM math lesson in Module 3), and multimodal chat templates are more failure-prone than text-only templates — the image placeholder, encoding format, and resize policy all have to match what the model was trained to expect." },
            { t: "callout", x: "A single high-resolution image can consume thousands of tokens of context budget. Multimodal inputs should be counted with the same care as text tokens — long conversations with multiple images can exhaust a 128K window faster than long text-only conversations." },
            { t: "p", x: "Small vision-language models can hallucinate visual details, miss text in images with non-trivial OCR demands, and struggle with charts, tables, and dense figures. Architectural style also matters: models trained multimodal from the ground up tend to generalize better across visual tasks than text-only models with a vision adapter bolted on later. For any serious document- or image-extraction workflow, evaluation on real samples — invoices the operator actually needs to parse, photographs from the actual capture conditions — is the only honest measure. A clean demo on simple photos is not evidence of production reliability." }
          ],
          quiz: [
            { q: "A single high-resolution image consumed by a multimodal model usually costs…",
              a: ["Just a few tokens", "Thousands of tokens — counted against your context budget", "Nothing — images are free", "Exactly 1 token"],
              c: 1,
              e: "Vision encoders turn image patches into tokens. They come out of the same context budget as text." },
            { q: "Which is true about small vision-language models?",
              a: ["They can be trusted with no evaluation", "They may hallucinate visual details", "They handle charts and tables perfectly", "Their OCR reliability is uniform across all images"],
              c: 1,
              e: "VLMs make confident visual mistakes. Evaluate with your real samples — don't trust a clean demo." },
            { q: "For serious invoice or document extraction, the right approach is to…",
              a: ["Trust the demo on simple photos", "Evaluate with your own real samples and edge cases", "Skip evaluation since it's just text", "Always use the largest model and ship it"],
              c: 1,
              e: "Charts, tables, scans, photo angles — your real data is the only honest test." }
          ]
        },
        {
          id: "m5l3",
          title: "RAG Beats Giant Prompts",
          blocks: [
            { t: "p", x: "Retrieval-Augmented Generation (RAG) is a pattern in which the application retrieves relevant chunks from a document corpus at query time and supplies only those chunks to the model, rather than dumping the entire corpus into the prompt. The model still generates the answer, but its evidence is restricted to retrieved spans drawn from a known source." },
            { t: "visual", id: "ragVsLlmOnly" },
            { t: "p", x: "RAG often outperforms a long-context approach for four reasons. Cost: prefill scales linearly with prompt length, and processing an entire corpus on every query is wasteful when only a small fraction is relevant. Quality: attention degrades across distance (the lost-in-the-middle pattern noted in the Long Context lesson), and a tightly scoped prompt avoids that decay. Freshness: a vector index can be updated incrementally as documents change, with no need to retrain or re-fine-tune the model. Citability: retrieved chunks have known provenance, making citations auditable in a way that a single long prompt cannot match." },
            { t: "p", x: "A working local RAG system typically includes ingestion, parsing, chunking, embeddings, a vector index, retrieval, reranking, prompt construction, generation, grounding checks, and evaluation. Each stage is a potential failure point. Parsing failures lose information that no later stage can recover. Chunking failures split answers across boundaries. Retrieval failures return irrelevant evidence. Reranking failures place the correct chunk below the cutoff. The dominant failure modes in practice live in parsing and chunking — well upstream of the LLM itself." },
            { t: "expand", x: "Un-pack — ingestion, parsing, chunking, embeddings, vector index, retrieval, reranking, grounding", blocks: [
              { t: "defs", items: [
                { term: "ingestion", def: "The first pipeline stage: loading source documents (PDFs, HTML, transcripts, office files) into a form the rest of the pipeline can process." },
                { term: "parsing", def: "Extracting clean text from ingested documents. Straightforward for plain text and Markdown, considerably harder for PDFs with tables, multi-column layouts, or scanned pages. Information lost at parsing cannot be recovered downstream." },
                { term: "chunking", def: "Splitting parsed text into pieces small enough to fit into the model's context alongside other retrieved chunks. Chunking strategy is one of the largest quality levers in a RAG pipeline — a chunk that splits a sentence or separates a claim from its qualifier degrades every downstream stage." },
                { term: "embedding", def: "The vector representation produced by an embedding model for a chunk of text. Embeddings that lie close together in vector space represent semantically similar content." },
                { term: "embedding model", def: "A separate (usually small) model whose only output is a vector representation of input text. Common examples: BGE, E5, GTE, nomic-embed. Distinct from the generation LLM and tuned for a different objective." },
                { term: "vector index", def: "A database optimized for nearest-neighbor queries over high-dimensional vectors. Common examples: FAISS, Qdrant, Chroma, pgvector, LanceDB. Returns the K closest chunks to a query vector." },
                { term: "retrieval", def: "The lookup step: embed the user's query with the same embedding model used at ingestion, query the vector index, and return the top-K most similar chunks as candidate evidence." },
                { term: "reranking", def: "A second pass over the top-K retrieved chunks using a slower but more accurate model (often a cross-encoder) that re-orders them by relevance to the query. Frequently the difference between mediocre and good retrieval — but only when the correct chunk is already within the top-K." },
                { term: "grounding", def: "Verification that the generated answer is supported by the retrieved chunks. A grounding check is an automated test, typically performed by a separate model or rule, that flags answers containing claims not present in the evidence." }
              ]}
            ]},
            { t: "callout", x: "The dominant failure modes in RAG systems sit upstream of the LLM: parsing that loses table structure or column boundaries, chunking that splits answers across pieces, retrieval that returns related-but-wrong chunks, and absence of evaluation that would surface the failures. Swapping in a larger generation model does not fix any of these problems." },
            { t: "p", x: "Chunking strategy is the most common silent contributor to RAG failure. Fixed-size chunks with no overlap routinely split sentences and separate claims from their context. Semantic chunking that respects natural boundaries, hierarchical chunking with parent-document retrieval, and sentence-window chunking with overlap each address different failure cases. No universal best strategy exists; evaluation on the actual document set is the only reliable way to choose. A capable reranker can rescue mediocre retrieval, but it cannot restore information that chunking already destroyed." },
            { t: "widget", id: "chunkerDemo" }
          ],
          quiz: [
            { q: "Most bad RAG systems fail because of…",
              a: ["The LLM is too small", "Chunking, retrieval, reranking, or evaluation problems", "The LLM is too quantized", "The vector index is the wrong color"],
              c: 1,
              e: "The pipeline around the LLM is usually the bottleneck. Inspect parsed text and chunk boundaries before swapping models." },
            { q: "A reranker is good at…",
              a: ["Rescuing chunks that lost the answer during ingestion", "Reordering retrieved chunks to surface the most relevant — IF the answer is somewhere in the top-K", "Replacing the embedding model", "Fixing a broken tokenizer"],
              c: 1,
              e: "Rerankers can rescue mediocre retrieval — but they can't recover information that chunking destroyed." },
            { q: "Fixed-size chunks with NO overlap most commonly cause…",
              a: ["Faster ingestion", "Lower memory usage", "Sentences and answers split across chunk boundaries", "Better embeddings"],
              c: 2,
              e: "An answer split across two chunks may never be retrieved together — overlap or semantic chunking fixes this." },
            { q: "Which stage is the 'silent killer' in most RAG systems?",
              a: ["Embedding generation", "Vector index choice", "Chunking strategy", "Prompt construction"],
              c: 2,
              e: "Bad chunks lose context before retrieval even runs. Reranking can't fix what chunking destroyed." }
          ]
        },
        {
          id: "m5l4",
          title: "Documents and Knowledge Work",
          blocks: [
            { t: "p", x: "Private-document workflows are a natural fit for local LLMs: meeting-transcript summaries, contract review, technical-documentation Q&A, research-note synthesis, email drafting, policy search, internal support assistants, and compliance workflows all benefit from keeping source material on operator-controlled hardware. This lesson applies the RAG pipeline from the previous lesson to specific document classes — the techniques are the same; the per-document-type choices change." },
            { t: "h", x: "The workflow, with reasoning" },
            { t: "list", items: [
              "Parse with attention to structure — tables, columns, headers, footnotes, and OCR-only regions all require explicit handling. Information lost at parsing cannot be recovered downstream.",
              "Preserve page numbers, section anchors, speaker labels, timestamps, and other locator metadata on every chunk. Citations are only useful if they map back to a specific span in the source.",
              "Chunk semantically along natural document boundaries (clauses, sections, paragraphs) rather than by arbitrary token count, so retrieved evidence preserves meaning.",
              "Use embeddings sized to the corpus (small models for fast iteration, larger models when retrieval quality plateaus) and apply a reranker over the top-K candidates.",
              "Construct prompts that request citations tied to chunk identifiers — the answer is only auditable when each claim references a retrieved span.",
              "Separate retrieved evidence from general model reasoning in the prompt structure, so the reader can distinguish corpus-grounded statements from the model's interpolations.",
              "Evaluate citation faithfulness routinely — the answer can sound correct while citing chunks that do not actually contain the supporting text."
            ]},
            { t: "p", x: "Per-document-type adjustments make the workflow concrete. Meeting transcripts benefit from chunks that preserve speaker labels and timestamps so a citation maps to who said what when. Contracts respond best to chunking by clause or section, because legal claims are coupled to their immediate context. Technical documentation Q&A benefits from including page numbers or anchor IDs in retrieved chunks so the model can cite specific spans the reader can verify." },
            { t: "callout", x: "The model only knows what arrives in its context. For document workflows, the parser and the retriever are at least as important as the choice of generation model — a state-of-the-art model fed badly parsed or badly retrieved evidence will produce confidently wrong answers." }
          ],
          quiz: [
            { q: "For contract review, the best chunking strategy is usually…",
              a: ["Random fixed-size chunks", "By clause or section rather than arbitrary token count", "Whole-document only", "Page-based without metadata"],
              c: 1,
              e: "Contracts have natural semantic boundaries — chunking by those preserves meaning and supports clean citations." },
            { q: "For meeting transcripts, what should you preserve in your chunks?",
              a: ["Just the words", "Speaker labels and timestamps", "Only the topic of the meeting", "The audio file itself"],
              c: 1,
              e: "Speaker + timestamp metadata is what makes meeting answers verifiable later." },
            { q: "For private document workflows, the most important rule is…",
              a: ["Use the biggest model", "Skip retrieval to save complexity", "Your parser and retriever matter as much as the model", "Always use the highest temperature"],
              c: 2,
              e: "The model only knows what you put into the prompt. Garbage in (bad parsing, bad retrieval) = garbage out, regardless of model size." }
          ]
        },
        {
          id: "m5l5",
          title: "Coding With Local Models",
          blocks: [
            { t: "p", x: "Coding is one of the strongest application areas for local LLMs. Prompts routinely include private code that should not leave the operator's environment; latency matters during interactive use; iteration is frequent enough that hosted-API costs accumulate quickly; and local models integrate cleanly with editors, shells, grep, test runners, and patch workflows that an external API endpoint would have to call back into." },
            { t: "callout", x: "A capable local coding setup is more than a model in isolation. It is a code-tuned instruct model paired with targeted repository context — typically retrieved against the codebase using the same RAG techniques covered earlier in this module — together with file paths, relevant snippets, test execution, and a patch-application loop. The model is one component; the surrounding scaffolding determines whether the result is useful." },
            { t: "p", x: "Decoding should be deterministic or low-temperature for code generation, where correctness matters more than diversity. Prompts should request patches in a verifiable format rather than freeform suggestions. Tests should run automatically on generated changes so regressions surface immediately. A small in-house evaluation set of real bugs and tasks from the codebase is the only credible way to tell when a new model is genuinely better — generic coding leaderboards do not predict performance on a specific codebase. Running local does not by itself make a coding system reliable; it makes the context private, the iteration loop cheaper, and the integration easier to control — which together create the conditions for reliability, with the next lesson on agents covering the safety constraints that any system applying patches autonomously must respect." },
            { t: "widget", id: "codingHabits" }
          ],
          quiz: [
            { q: "A strong local coding setup is NOT just a chatbot — it also includes…",
              a: ["Just the model and a window", "Repo retrieval, file paths, test execution, and a patch loop", "Maximum temperature only", "A web browser"],
              c: 1,
              e: "Coding agents need real integration: the right files in context, automatic tests, patches not prose." },
            { q: "For first-pass code generation, what decoding setting is recommended?",
              a: ["High temperature for creativity", "Deterministic or low-temperature", "Skip stop tokens entirely", "Maximum top-p"],
              c: 1,
              e: "Conservative decoding produces correct, reviewable patches. Sample alternatives only when you're intentionally exploring." },
            { q: "How do you tell if a new local code model is actually better?",
              a: ["It has more parameters", "It has a newer release date", "A small eval set of real bugs and tasks shows it wins", "It's smaller"],
              c: 2,
              e: "Your own eval set is the only honest measure — generic leaderboards don't predict your codebase." }
          ]
        },
        {
          id: "m5l6",
          title: "Local Agents Need Guardrails",
          blocks: [
            { t: "p", x: "A local LLM becomes considerably more capable once it can invoke tools — file search, shell commands, browser automation, database queries, code execution, calendar access, ticketing systems, internal APIs, vector databases, home-automation hubs, robotics interfaces, or edge devices. A system that not only generates text but also acts on the operator's environment is what most current literature calls an agent." },
            { t: "callout", x: "Tool use changes the safety model. A chatbot that hallucinates produces incorrect text. An agent that hallucinates can delete files, send emails, leak credentials, execute commands, or move money. The blast radius of an error is no longer confined to the conversation — it extends to every resource the agent's tools can reach." },
            { t: "h", x: "Four layers of local-agent safety" },
            { t: "list", items: [
              "Scope: grant the agent only the directories, APIs, network endpoints, and credentials it requires to do its job. Default to no access; add capabilities deliberately.",
              "Execution constraint: run tool calls under sandboxes, containers, or unprivileged user accounts; require confirmation for destructive actions; validate tool arguments against an explicit schema before dispatch.",
              "Hostile-input assumption: retrieved documents, web pages, tickets, emails, and any other text the agent reads can contain instructions targeted at the model. The previous lesson on coding-with-local-models and the RAG lesson both feed into this — retrieved content is exactly the channel through which prompt injection arrives in practice.",
              "Audit trail: log tool calls, model identifiers and versions, prompts, outputs, and human approvals. Logs should preserve enough context to reconstruct a failure without persisting secrets in plain text."
            ]},
            { t: "p", x: "Structured outputs are a reliability tool, not a security boundary. JSON schemas and constrained decoding make tool calls easier to parse and validate, and they reduce malformed-request failures. They do not, however, prove that the model interpreted the user's intent correctly or that it ignored injected instructions in retrieved content. Any system that takes actions on the operator's behalf needs policy enforcement outside the model — request approval flows, allowlists, rate limits, and independent verification — because the model itself is part of the threat surface, not the place to validate against it." }
          ],
          quiz: [
            { q: "An agent with shell access is different from a chatbot because…",
              a: ["It's slower", "It can damage the machine faster than you can read the logs", "It uses less VRAM", "It's always more accurate"],
              c: 1,
              e: "Tool use changes the safety model — a hallucinating chatbot is annoying; an agent with the wrong tool firing is destructive." },
            { q: "Treating retrieved documents as hostile means…",
              a: ["Never using RAG", "Watching for prompt injection that tries to redirect the model", "Encrypting all documents", "Avoiding any web sources"],
              c: 1,
              e: "Web pages, emails, tickets, and PDFs can contain instructions aimed at the model. The agent layer must assume that." },
            { q: "Structured outputs (JSON schemas, constrained decoding) are…",
              a: ["A complete security boundary", "A reliability aid — NOT a security boundary; policy checks live outside the model", "Useless for agents", "Only useful for chat, not for tools"],
              c: 1,
              e: "Schemas make tool calls validatable, but they don't prove the model understood the request or resisted injection. Real policy checks happen outside the model." },
            { q: "Which of these is the right way to scope a local agent?",
              a: ["Give it everything by default and remove later", "Give it only the directories, APIs, network access, and credentials it actually needs", "Run it as root for simplicity", "Skip credentials entirely"],
              c: 1,
              e: "Least privilege from the start. Scope tightly, sandbox execution, audit tool calls." }
          ]
        },
        {
          id: "m5l7",
          title: "Fine-Tuning",
          blocks: [
            { t: "p", x: "Fine-tuning modifies an existing model's behavior by continuing training on additional data. For local operators, the two dominant methods are LoRA (Low-Rank Adaptation) and QLoRA. LoRA freezes the base model's weights and trains a small set of low-rank adapter matrices that compose with the frozen weights at inference time; the trainable parameter count is typically under 1% of full fine-tuning, multiple adapters can be maintained for the same base model, and the resulting adapters are small enough to ship and version independently. QLoRA extends LoRA by training the adapters through a base model held in 4-bit quantization (see the Quantization lesson in Module 2 for the bytes-per-parameter mechanics) — the base stays compressed in memory during training, the adapter trains at full precision, and the practical effect is that meaningfully larger base models can be fine-tuned on a single consumer GPU." },
            { t: "p", x: "Beyond standard supervised fine-tuning (SFT) on input-output pairs, preference-optimization methods such as Direct Preference Optimization (DPO) and its variants (ORPO, IPO, KTO) train on pairs of preferred and dispreferred outputs to align model behavior with chosen response patterns. The distinction matters for choosing a method: SFT teaches the model what an answer looks like; preference optimization teaches it which answer is better when multiple plausible ones exist." },
            { t: "expand", x: "Un-pack — fine-tuning, frozen base, LoRA, low-rank, adapter, QLoRA, splits, overfitting", blocks: [
              { t: "defs", items: [
                { term: "fine-tuning", def: "The process of taking a pretrained model and continuing training on task-specific data so the model's behavior shifts toward the desired pattern. Distinct from training from scratch." },
                { term: "frozen base", def: "The pretrained model's weights held constant during fine-tuning. Only a smaller set of new parameters (typically adapter weights) is updated. Substantially cheaper and lower-risk than full fine-tuning, which updates all weights." },
                { term: "LoRA", def: "Low-Rank Adaptation. Instead of updating large weight matrices directly, LoRA adds a correction term factored into two low-rank matrices, and only those low-rank matrices are trained. The trainable parameter count is typically under 1% of full fine-tuning." },
                { term: "low-rank", def: "A matrix that can be expressed as the product of two smaller matrices, dramatically reducing parameter count. The empirical observation behind LoRA is that the updates required to specialize a pretrained model often live in a low-rank subspace, so a low-rank approximation captures most of the useful change." },
                { term: "adapter", def: "The set of weights actually trained and shipped — the LoRA matrices in a LoRA workflow. Multiple adapters can be loaded over the same base model and switched per request without reloading the base." },
                { term: "QLoRA", def: "Quantized LoRA. The base model is held in 4-bit quantization during training while the LoRA adapter trains at full precision. The combination enables fine-tuning of base models substantially larger than would fit at full precision on the same hardware." },
                { term: "SFT (supervised fine-tuning)", def: "Fine-tuning on a dataset of input-output pairs, where the model learns to reproduce the desired output for each input. The most common fine-tuning regime." },
                { term: "preference optimization", def: "A family of methods (DPO, ORPO, IPO, KTO) that train on pairs of preferred and dispreferred outputs to shape behavior toward chosen response patterns. Used when the goal is choosing between plausible answers rather than learning what an answer looks like." },
                { term: "train / val / test split", def: "A partitioning of the dataset into three slices. The training slice updates the model; the validation slice tracks progress and tunes hyperparameters during training; the test slice is held back until the end to provide an unbiased quality measurement." },
                { term: "overfitting", def: "A state in which the model has begun memorizing the training set rather than generalizing. The diagnostic signature is training loss continuing to drop while validation loss starts rising; training should be stopped at or before that crossover." },
                { term: "regression eval", def: "An evaluation performed after fine-tuning to verify that the model has not lost capability on tasks it previously handled correctly. Catching capability regressions requires preserving a representative test set from before the fine-tune." }
              ]}
            ]},
            { t: "p", x: "Fine-tuning is the appropriate intervention when the goal is a consistent writing style, a strict domain-specific output format, repetitive classification or extraction behavior, reliable tool-call format adherence, a specialized persona, domain adaptation that retrieval cannot address, or improving a small model on a narrow task where a larger general model is too expensive to run." },
            { t: "callout", x: "Fine-tuning is rarely the first intervention to try. The conventional order is: verify the chat template is correct for the model in use; improve the prompt; try a stronger base model; tune decoding parameters; add retrieval (RAG); add reranking over retrieved chunks; add few-shot examples; only then consider fine-tuning. A substantial fraction of problems that present as 'the model does not understand my domain' turn out to be a wrong chat template, an underspecified prompt, or a broken retrieval pipeline." },
            { t: "p", x: "A defensible fine-tuning plan includes clean training data with documented provenance, train / validation / test splits, baseline evaluation on the pre-fine-tune model, a clear specification of target behavior, safety review of the training data and intended use, overfitting monitoring during training, regression evaluation against the baseline, adapter versioning so previous behavior can be restored, license review of both the base model and the training data, and a rollback plan in the event the fine-tuned adapter degrades the deployment in ways the eval set missed." }
          ],
          quiz: [
            { q: "The recommended order to try BEFORE fine-tuning is:",
              a: ["Skip everything, just fine-tune first", "Correct chat template, better prompting, better model, better decoding, RAG, reranking, few-shot examples, THEN fine-tuning", "Only fine-tuning", "Hyperparameter search first"],
              c: 1,
              e: "Most 'the model doesn't understand my domain' problems are actually template, prompt, or retrieval bugs. Fine-tuning is the last resort." },
            { q: "QLoRA lets you…",
              a: ["Fine-tune through a frozen 4-bit quantized base model into LoRA adapters", "Fully fine-tune a 70B model on a phone", "Skip adapters entirely", "Bypass evaluation"],
              c: 0,
              e: "QLoRA = quantized base + LoRA adapter. Lets you fine-tune very large models on a single consumer GPU." },
            { q: "A telltale sign your model is overfitting?",
              a: ["Train accuracy down, validation up", "Train accuracy keeps going up while validation accuracy starts going down", "Loss stays the same throughout", "The model gets faster"],
              c: 1,
              e: "Classic overfitting curve — the model has stopped learning patterns and started memorizing examples. Stop training." },
            { q: "Why is the test split separate from validation?",
              a: ["They serve identical purposes", "Validation tunes hyperparameters; test gets touched ONCE at the end to honestly measure quality", "Test is for training", "Test is optional"],
              c: 1,
              e: "If you tune on test, you contaminate it and lose the honest measurement. Keep it untouched until the very end." }
          ]
        }
      ]
    },

    {
      id: "m6",
      title: "Operating in Practice",
      summary: "Choosing a model that fits, the true cost of running local, the 2026 model scene, inference-layer advances, benchmarks, privacy, licensing, failure-mode diagnosis, edge deployment, the practitioner's progression, and the runbook.",
      lessons: [
        {
          id: "m6l1",
          title: "Choose a Model That Fits",
          blocks: [
            { t: "p", x: "The practical question is rarely 'what is the best model?' It is 'what is the smallest model that wins the actual workload on the available hardware?' Smaller-that-wins beats biggest-available on every operational dimension: lower memory pressure, faster inference, faster iteration, smaller download, and more headroom for context growth." },
            { t: "p", x: "A reasonable starting point is a recent instruct or chat model that fits comfortably at the context length the workload actually requires. On 8–12 GB, the practical range is small instruct models (1B–4B). On 16–24 GB, 7B–14B class models become the working tier (see the Hardware Tiers lesson in Module 3 for the broader mapping). At 48 GB and above, larger dense models and MoE variants are realistic. The mapping is approximate — quantization choice and context length both shift it." },
            { t: "callout", x: "Memory gate before committing to a checkpoint: weights + KV cache for target context + runtime overhead ≤ 80–90% of available memory. Use the VRAM math from Module 3 to estimate before downloading." },
            { t: "h", x: "Five fit checks" },
            { t: "list", items: [
              "Task fit: chat, coding, documents, agents, multimodal, edge, or fine-tuning — the model's tuning should match the dominant task.",
              "Memory fit: weights, KV cache for the actual context length, runtime overhead, and safety margin all add up within the hardware budget.",
              "Interface fit: tokenizer, chat template, stop tokens, tool schema, and reasoning-mode switches all match what the runtime and application expect.",
              "Runtime fit: the chosen runtime supports the model's architecture, quantization format, context length, and serving mode well — not just nominally.",
              "License fit: the license permits the intended use (commercial, redistribution, scale tier, geography). See the Open-Weight Does Not Mean Opensource lesson later in this module."
            ]},
            { t: "p", x: "Once candidates pass the fit checks, run the same 20–50 prompts across each one. The prompts should include real tasks from the intended workload, not generic benchmarks. Measure answer quality, latency, memory use, template reliability, and failure modes. Public leaderboards are useful for discovery; they are not a substitute for an in-house evaluation. The Benchmarks That Matter lesson later in this module describes the dimensions that belong in such an evaluation." }
          ],
          quiz: [
            { q: "The practical question is NOT 'what's the best model?' It's…",
              a: ["'What's the most popular model on Reddit?'", "'What's the smallest model that wins my real workload on my hardware?'", "'What's the biggest model I can find?'", "'What does the leaderboard say?'"],
              c: 1,
              e: "Smallest-that-wins beats biggest-available — less memory, faster inference, easier to iterate." },
            { q: "The memory gate before falling in love with a checkpoint:",
              a: ["Weights ≤ available memory", "Weights + KV cache + runtime overhead ≤ 80–90% of available memory", "Weights × 2 ≤ available memory", "No memory check is needed"],
              c: 1,
              e: "Add up the FULL memory bill including KV cache and overhead, then leave headroom. Weight size alone is misleading." },
            { q: "Leaderboards are best used for…",
              a: ["Choosing your local stack", "Discovery — they're not a substitute for your own evals", "Setting model parameters", "Picking quantization"],
              c: 1,
              e: "Use leaderboards to find candidates; use your own eval set to pick a winner." }
          ]
        },
        {
          id: "m6l2",
          title: "The Cost of Local",
          blocks: [
            { t: "p", x: "Running a model locally trades a recurring per-token API bill for a different cost structure: an up-front hardware investment, ongoing electricity draw, operator time spent on setup and maintenance, and the opportunity cost of whatever the equivalent hosted-API spend would have been. The economic case for local is sometimes obvious and sometimes a wash; the goal of this lesson is to make the calculation explicit rather than leaving it as a gut feeling." },
            { t: "h", x: "The four cost components" },
            { t: "list", items: [
              "Hardware capital expense, amortized: the purchase price of GPUs, system memory, storage, and supporting infrastructure, spread across the expected useful life of the equipment. A consumer GPU might be amortized over 3–5 years; a server-class accelerator might be amortized over a shorter horizon if frontier-model performance is the goal and depreciation against newer hardware is fast.",
              "Electricity: the steady-state power draw under typical workload, plus idle draw between active periods. A workstation GPU under sustained load might consume 300–450 watts; an idle workstation might still draw 50–100 watts. At a typical commercial electricity rate, sustained 24/7 operation of a single high-end GPU runs into the hundreds of dollars per year before considering cooling overhead.",
              "Operator time: initial setup, model selection, runtime configuration, ongoing model updates as the field churns, runtime upgrades, debugging when something breaks, evaluation maintenance, and security patches. This cost is the most frequently underestimated and is rarely zero even for hobby deployments.",
              "Opportunity cost: the equivalent hosted-API spend for the same workload. A workload generating 10M tokens per month against a frontier hosted API at typical 2026 rates produces a meaningful monthly bill; that bill is the benchmark against which the other three components are compared."
            ]},
            { t: "p", x: "A concrete order-of-magnitude example helps anchor the calculation. A workstation built around a 24 GB consumer GPU at roughly $2,500 in hardware, amortized over four years, costs about $52 per month in capex. Adding $20–40 per month in electricity under moderate use and an estimated 4 hours of monthly operator time at the operator's loaded hourly rate yields a fully loaded monthly cost commonly in the $200–500 range, depending heavily on the operator-time term. Dividing this by the actual monthly token volume the workstation produces gives a cost-per-million-tokens figure that can be compared directly against the hosted-API price list for an equivalent-quality model. Low monthly volume yields a high cost-per-token; high sustained volume drives it well below hosted-API prices." },
            { t: "h", x: "Break-even framework" },
            { t: "list", items: [
              "Estimate the actual monthly token volume the deployment will produce, in both prompt tokens and output tokens. Hosted pricing typically differs between the two.",
              "Compute the hosted-API monthly cost at the relevant per-token rate for a comparable-quality model.",
              "Compute the local monthly cost as amortized capex + electricity + operator-time-at-loaded-rate.",
              "Compare. If the local figure is lower at the projected volume, local wins on cost. If hosted is lower, local must justify itself on other grounds — privacy, latency, custom behavior, offline operation — or be deferred."
            ]},
            { t: "h", x: "Workloads where local wins on cost" },
            { t: "list", items: [
              "High sustained token throughput: heavy generation, document processing, batch jobs, or anything that keeps the GPU busy a substantial fraction of the day amortizes the capex quickly.",
              "Long prompts and long responses: hosted pricing scales with token count, so workloads with large prompts (RAG with many retrieved chunks, long-document analysis) or long generations push the hosted bill up while the local cost is roughly constant.",
              "Privacy-constrained workloads: when regulatory or contractual requirements forbid sending data to a third-party API, the hosted option is off the table and the comparison is moot.",
              "Stable model selection: if the workload runs against the same model for months without churn, the operator-time term stays small. Constant model-shopping inflates it."
            ]},
            { t: "h", x: "Workloads where hosted wins on cost" },
            { t: "list", items: [
              "Low or bursty volume: a few hundred queries a month does not amortize a workstation GPU; even modest hosted-API spend is cheaper than the depreciation alone.",
              "Frontier-quality requirements: when the workload genuinely needs the largest available model and no locally runnable model is close in quality, the hosted endpoint provides capability that local cannot match at any reasonable hardware cost.",
              "No operator bandwidth: when nobody on the team has time to maintain a local stack, the operator-time term explodes and any nominal hardware advantage disappears.",
              "Highly variable workloads: hosted endpoints scale instantly between zero and high concurrency; a fixed local GPU is either idle (wasting capex) or saturated (introducing latency) at extremes."
            ]},
            { t: "callout", x: "Naive cost analyses commonly miss several recurring categories: cooling and HVAC overhead in workspaces not designed for sustained 300W+ draw, the cost of the second GPU purchased when the first turns out to be insufficient, the cost of disk space for accumulated quantized variants of multiple models, the security and patching time for an internet-exposed inference server, the cost of evaluation infrastructure to verify that the local model actually produces acceptable output, and the operator-time cost of every model upgrade as the open-weight scene evolves. Adding 30–50% to a naive estimate to absorb these is closer to operating reality than the bare four-component math suggests." }
          ],
          quiz: [
            { q: "The four primary cost components of running a model locally are…",
              a: ["Just hardware and electricity", "Hardware capex amortized, electricity, operator time, and opportunity cost vs hosted API", "Just the API alternative", "Hardware and licensing only"],
              c: 1,
              e: "All four matter. Operator time and opportunity cost are the most frequently underestimated." },
            { q: "Local typically wins on cost when…",
              a: ["Volume is low and bursty", "Sustained throughput is high, prompts and responses are long, or privacy constraints rule out hosted APIs", "Frontier-model quality is the only acceptable bar", "Nobody on the team has ops bandwidth"],
              c: 1,
              e: "High sustained utilization amortizes the capex quickly; long prompts and outputs inflate the hosted bill against which local is compared." },
            { q: "Hosted APIs typically win on cost when…",
              a: ["Volume is high and sustained", "Volume is low or bursty, frontier quality is required, or ops bandwidth is unavailable", "Privacy requirements forbid sending data out", "Prompts and responses are very long"],
              c: 1,
              e: "Low volume does not amortize hardware; frontier quality demands models too large for local hardware; missing ops bandwidth inflates the operator-time term." },
            { q: "Which cost component is most frequently underestimated in DIY break-even analyses?",
              a: ["Hardware capex", "Electricity", "Operator time spent on setup, updates, debugging, and evaluation maintenance", "The actual API bill"],
              c: 2,
              e: "Operator time is rarely zero, scales with model churn, and is the term that most often turns a paper-winning local deployment into a wash in practice." }
          ]
        },
        {
          id: "m6l3",
          title: "The 2026 Local Model Scene",
          blocks: [
            { t: "p", x: "The model landscape churns on a timescale of months, not years. As of May 2026, the right unit of analysis is the family and its surrounding ecosystem rather than the single best checkpoint. A family represents a coordinated release plan, a tokenizer and chat template the runtime understands, a quantization pipeline, a licensing posture, and a community building tooling around it — committing to a model is committing to all of those." },
            { t: "list", items: [
              "Qwen 3.5 / 3.6: a major open-weight family spanning the full size range — small laptop models, dense mid-size models, MoE variants, FP8 releases, long context, multilingual support, coding-tuned variants, tool-use variants, and agent-tuned variants. A strong default ecosystem for general-purpose local work.",
              "Gemma 4: Google DeepMind's open-weight family aimed at practical local deployment. Includes efficient edge sizes, larger dense and MoE options, multimodal variants, long context, broad language support, and Apache 2.0 licensing — relevant when commercial deployment or device-side use is the requirement (see the licensing lesson later in this module).",
              "Kimi / Moonshot, GLM / Z.ai, DeepSeek, MiniMax, Mistral: core families to track for long-horizon coding, agent workflows, MoE systems, and deployment-oriented releases. Strengths differ by family — DeepSeek's MLA attention and aggressive MoE designs, GLM's coding focus, Mistral's commercial-friendly licensing — and the right choice depends on the workload.",
              "Nemotron 3: NVIDIA's open family targeting agent-system deployment on NVIDIA hardware. Nano, Super, and Ultra sizes; hybrid Mamba-Transformer MoE architecture; integration with TensorRT-LLM, NIM, and Blackwell NVFP4 / FP8 paths."
            ]},
            { t: "expand", x: "Un-pack — the families and the jargon (YaRN, MLA, hybrid Mamba-Transformer)", blocks: [
              { t: "defs", items: [
                { term: "Qwen", def: "Alibaba's open-weight family. Broad lineup from 0.5B laptop models to 200B+ MoE; strong on coding, multilingual, tool use, long context. Permissive licenses on most variants." },
                { term: "Gemma", def: "Google DeepMind's open-weight family. Apache 2.0 — friendly for commercial use. Strong edge sizes (E2B / E4B), competitive larger sizes (26B A4B, 31B), multimodal." },
                { term: "Kimi / Moonshot", def: "A Chinese AI lab. Models known for very long context, agentic workflows, and multimodal reasoning." },
                { term: "GLM / Z.ai", def: "Tsinghua / Zhipu's family. Strong on coding and long-horizon agent tasks. Includes MoE variants." },
                { term: "DeepSeek", def: "A Chinese lab. Famous for huge MoE models (V3, R1) and aggressive efficiency tricks — MLA, DeepSeekMoE, sparse attention." },
                { term: "MiniMax", def: "Another Chinese lab. Practical agent-tuned models, inference-efficient MoE designs." },
                { term: "Mistral", def: "French lab. Lineup covers generalist, coding (Codestral), reasoning, and multimodal (Pixtral). Open-weight on many releases." },
                { term: "Nemotron", def: "NVIDIA's open agent-tuned family. Nano / Super / Ultra sizes. Tied closely to TensorRT-LLM, NIM, and NVIDIA's serving stack." },
                { term: "hybrid Mamba-Transformer", def: "An architecture that mixes regular Transformer blocks with Mamba (state-space) blocks. Mamba layers are linear-time in context length, so long context gets much cheaper. Nemotron 3 uses this." },
                { term: "YaRN", def: "A RoPE-extension technique that stretches a model's effective context window beyond what it was trained for — for example, running a 32K-trained model at 128K. Quality typically degrades at the extended length and the technique is most appropriate as a stopgap when longer context is required and retraining is not available." },
                { term: "MLA", def: "Multi-head Latent Attention. DeepSeek's attention variant that compresses the KV cache aggressively while preserving quality. One of the architectural reasons their MoE models are practical to serve at scale." }
              ]}
            ]},
            { t: "p", x: "Qwen 3.5 / 3.6 27B Dense is a common practical default among 2026 public-weight options for operators who care about coding, multilingual work, tool use, mixed thinking and non-thinking modes, and long context up to 262,144 tokens (with YaRN extension in supported frameworks). Selecting it commits the operator to its tokenizer, chat template, quantization variants on the Hugging Face hub, runtime compatibility expectations, and license terms." },
            { t: "callout", x: "Open-weight AI in 2026 is no longer a binary choice between Llama and everything else. Selecting a model is selecting an ecosystem: the weights themselves, the license, the tokenizer, the chat template, the available quantization formats, runtime support coverage, the serving path, the community tooling, and the model's known failure modes. Each axis is a separate compatibility check." }
          ],
          quiz: [
            { q: "A strong open-weight family that covers laptop, mid-size, and MoE in 2026:",
              a: ["Llama 2 only", "Qwen 3.5 / 3.6", "GPT-4", "Claude 3"],
              c: 1,
              e: "Qwen spans tiny edge models to 200B+ MoE with strong coding, multilingual, and tool use — a practical default ecosystem." },
            { q: "Why does Gemma 4 stand out for commercial deployment?",
              a: ["It's the smallest", "It's the largest", "Apache 2.0 licensing — friendly for commercial use", "It has no license"],
              c: 2,
              e: "Apache 2.0 means you can use it commercially without the restrictions some other open-weight licenses add." },
            { q: "Picking an open-weight family is choosing…",
              a: ["Just weights", "Just a license", "An ecosystem: weights, license, tokenizer, template, quantizations, runtime support, community tools", "Just a benchmark score"],
              c: 2,
              e: "Open-weight AI is no longer Llama vs. everything else. You're committing to a whole ecosystem, not just a checkpoint." }
          ]
        },
        {
          id: "m6l4",
          title: "Inference Research",
          blocks: [
            { t: "p", x: "The active frontier in 2026 is not only model quality but also inference efficiency — the techniques that determine how much throughput, latency, and memory pressure the same model produces under realistic load. Several of the production techniques covered in the Production Serving Modes lesson originated here as research before being absorbed into serving engines. This lesson names the current research directions that are most likely to affect operational deployments in the near term." },
            { t: "expand", x: "Un-pack — PagedAttention, FP8 KV cache, DFlash, DDTree, NVFP4", blocks: [
              { t: "defs", items: [
                { term: "PagedAttention", def: "vLLM's KV-cache memory manager. Stores cache in fixed-size pages analogous to OS virtual memory, avoiding fragmentation and allowing many concurrent requests to share GPU memory efficiently. Production-ready and broadly adopted." },
                { term: "FP8 KV cache", def: "Storage of the KV cache in 8-bit floating point rather than 16-bit. Approximately halves cache memory consumption with minimal quality loss on most workloads. Supported in vLLM, SGLang, and other modern serving engines." },
                { term: "DFlash", def: "A 2026 speculative-decoding approach that uses a block-diffusion draft model to propose several tokens in parallel. The target model verifies them in a single pass, producing larger speedups than classic single-token draft-and-verify when the diffusion draft accepts well." },
                { term: "DDTree (DTree)", def: "A speculative-decoding variant that builds a tree of candidate draft tokens — rather than a single linear sequence — and verifies the whole tree in one pass. Higher acceptance rate per verification step than a flat draft, at the cost of additional verification compute." },
                { term: "NVFP4", def: "A 4-bit floating-point numeric format accelerated natively on NVIDIA Blackwell-class GPUs. Reduces both weight and activation memory traffic with hardware-level kernel support, materially changing decode performance on supported stacks." }
              ]}
            ]},
            { t: "callout", x: "Production-readiness varies across this list. PagedAttention and FP8 KV cache are widely available in production serving engines. NVFP4 is hardware-gated to recent NVIDIA generations and requires matching runtime support. DFlash and DDTree-class techniques are at the leading edge and may or may not be available in the operator's chosen runtime. A paper claim is not a feature flag — runtime support should be verified before counting on a claimed speedup." }
          ],
          quiz: [
            { q: "PagedAttention attacks which problem?",
              a: ["Tokenizer slowness", "KV-cache memory waste in serving", "Embedding mismatch", "Model file format conversion"],
              c: 1,
              e: "PagedAttention manages KV cache in fixed pages like an OS — avoids fragmentation, packs many concurrent sequences." },
            { q: "FP8 KV cache is…",
              a: ["Research only, not practical", "A practical runtime feature in systems such as vLLM", "Always worse quality than FP16", "Identical to INT4 KV"],
              c: 1,
              e: "FP8 KV cache is production-ready in modern serving engines and halves the cache memory with negligible quality loss." },
            { q: "Should you treat paper speedups as a checkbox in a desktop app?",
              a: ["Yes — they're all production-ready", "No — some are still research, and some only matter if your runtime supports them cleanly", "Only on NVIDIA hardware", "Only with Anthropic models"],
              c: 1,
              e: "A paper claim is not a feature flag. Check whether your runtime actually implements it before counting on the speedup." }
          ]
        },
        {
          id: "m6l5",
          title: "Benchmarks That Matter",
          blocks: [
            { t: "p", x: "A meaningful benchmark measures the stack that will actually be deployed. A model's BF16 leaderboard score on a generic benchmark does not predict the realized behavior of the same model at Q4 on a specific runtime, hardware, prompt distribution, and concurrency level. Closing the gap between the published number and the production number is the work of this lesson." },
            { t: "h", x: "Measure" },
            { t: "list", items: [
              "Quality: correctness on your real tasks, not only generic benchmarks.",
              "Latency: time to first token, decode tokens per second, end-to-end time.",
              "Memory: weight memory, KV-cache growth, peak VRAM, headroom under load.",
              "Formatting: chat template correctness, JSON/schema success, tool-call reliability, stop-token behavior.",
              "Retrieval: citation faithfulness, answer grounding, missing-evidence behavior, reranker impact.",
              "Operations: startup time, warmup, crash recovery, logging, privacy, version tracking."
            ]},
            { t: "p", x: "Create a small eval set with 30-100 representative prompts. Include expected answers or scoring criteria, latency and memory measurements, failure categories, RAG grounding checks, and human review for ambiguous tasks. Then compare models — do not let a leaderboard choose your local stack for you." },
            { t: "callout", x: "A standalone number like \"180 tokens per second\" is not a comparable benchmark — it reveals nothing about the stack under test. A comparable benchmark reports the exact model and parameter count, the weight precision and quantization format, the engine name and version with relevant runtime flags, the hardware SKU including memory bandwidth, the workload shape (input/output length distributions and concurrency), and the metrics that matter for the use case (TTFT, p95 / p99 latency, KV cache hit rate, memory headroom at target context, cost per million tokens). Only the second form is reproducible or comparable across configurations." },
            { t: "expand", x: "Un-pack — what a good engine/model benchmark actually reports", blocks: [
              { t: "defs", items: [
                { term: "Model details", def: "Exact model, architecture, parameter count, and (if MoE) active params per token. \"Qwen 3.6 27B Dense\" is meaningful; \"a 7B model\" is not." },
                { term: "Weight details", def: "Dtype, quantization format, group size, calibration set. A 4-bit AWQ ≠ a 4-bit GPTQ ≠ a Q4_K_M GGUF." },
                { term: "Engine details", def: "Name, version, commit, backend, runtime flags. vLLM 0.6.x with continuous batching off is a different machine than vLLM 0.6.x with it on." },
                { term: "Hardware details", def: "GPU SKU, VRAM capacity, memory bandwidth, interconnect (NVLink? NVSwitch? PCIe Gen?), CPU, system RAM. A 4090 result doesn't transfer to a 4080." },
                { term: "Workload shape", def: "Input/output length distributions (NOT just averages), concurrency level, streaming on/off, shared prefixes (does the workload benefit from prefix caching?), structured output requirements." },
                { term: "Metrics that matter", def: "TTFT (time to first token), TPOT (time per output token), end-to-end latency, p50 / p95 / p99 — not just averages, tokens/sec, requests/sec, GPU memory at peak, KV cache hit rate, prefill throughput, decode throughput, cost per 1M tokens." }
              ]}
            ]},
            { t: "h", x: "Benchmarking rules" },
            { t: "list", items: [
              "Engine comparisons should not rely on single-user tokens-per-second alone — that metric is the easiest to optimize against narrowly and the least predictive of multi-user behavior.",
              "Test against the actual prompt and output length distribution of the target workload, not the default leaderboard shape (commonly 1K input / 128 output, which is unrepresentative of most real applications).",
              "Test with realistic concurrency. A workload at one concurrent user behaves nothing like the same workload at fifty.",
              "Report prefill and decode metrics separately. They are different workloads with different bottlenecks (compute-bound versus bandwidth-bound, respectively).",
              "Report p95 and p99 latency in addition to averages. Averages hide tail behavior that users experience as occasional very-slow requests.",
              "Measure peak memory and headroom at the target context length, not at zero context. KV cache growth changes the picture.",
              "Test prefix caching when the workload has repeated openings — shared system prompts, multi-turn conversation history, repeated RAG-retrieved chunks. Cache hit rate substantially shifts TTFT and throughput.",
              "Benchmark structured output (JSON schema enforcement, grammar-constrained decoding) separately from freeform generation — constraint enforcement adds real overhead that freeform tests do not surface.",
              "Benchmark LoRA and multi-LoRA serving separately if production will use them, since the active adapter affects both memory and throughput.",
              "Re-test after every driver upgrade, runtime upgrade, model upgrade, or quantization change. Performance numbers drift continuously."
            ]}
          ],
          quiz: [
            { q: "A model's BF16 leaderboard score is…",
              a: ["Your Q4 local reality", "Not your Q4 local reality", "Always identical to its Q4 quality", "A direct measure of latency"],
              c: 1,
              e: "Different precision, different runtime, different hardware = different behavior. Benchmark the stack you'll actually run." },
            { q: "A useful eval set size for local LLM work:",
              a: ["1–2 prompts", "30–100 representative prompts of your real tasks", "100,000 prompts", "Zero prompts — just vibes"],
              c: 1,
              e: "30–100 is enough to spot real differences without spending forever scoring. Cover your real failure modes." },
            { q: "Which dimension is OFTEN forgotten in DIY benchmarks?",
              a: ["Quality", "Latency", "Memory behavior and format reliability (JSON, tool calls, stop tokens)", "Cost"],
              c: 2,
              e: "Quality on clean prompts is easy to measure; the failure modes that surface in production are memory growth under sustained load and format brittleness on edge cases." }
          ]
        },
        {
          id: "m6l6",
          title: "Privacy Is Not Automatic",
          blocks: [
            { t: "p", x: "Local LLMs improve privacy because prompts and outputs can remain on your hardware. But local does not automatically mean secure. Threats include malicious model files, pickle-based weight loading, untrusted trust_remote_code, prompt injection in retrieved documents, tool-call abuse, secret leakage through logs, telemetry from desktop apps, browser extensions, model hallucinations in high-stakes settings, license violations, and data contamination during fine-tuning." },
            { t: "expand", x: "Un-pack — trust_remote_code, prompt injection, telemetry, audit trail", blocks: [
              { t: "defs", items: [
                { term: "trust_remote_code", def: "A Hugging Face Transformers flag that permits a model to execute its own Python code at load time. Convenient for novel architectures, and a direct path for a malicious checkpoint to execute arbitrary code on the host. Should default to False and be enabled only for trusted sources." },
                { term: "prompt injection", def: "Hostile instructions embedded inside content the model is asked to process — a web page, an email, a retrieved document, an OCR'd image — that attempt to redirect the model's behavior (\"ignore your previous instructions and …\"). The principal attack surface for any system that consumes external content." },
                { term: "indirect prompt injection", def: "The agent-specific variant of prompt injection. The model retrieves a document, the document contains instructions targeted at the model, the model has tools available, and the tools execute the injected action. The path from retrieved content to executed action is the threat model that production agents must defend against." },
                { term: "data contamination", def: "A state in which fine-tuning data inadvertently contains evaluation set items, secret material, or copyrighted content. The model memorizes the contaminated material and may emit it later under unrelated prompts." },
                { term: "telemetry", def: "Outbound network traffic from a desktop application reporting usage statistics, error reports, or — in some cases — prompt content. A locally running model does not preclude the surrounding application phoning home; vendor settings should be reviewed before processing sensitive material." },
                { term: "audit trail", def: "Logs recording which prompts were sent, which model and adapter versions handled them, which tools fired with which arguments, and which approvals were granted. Essential for debugging agent failures and for after-the-fact incident response. Logs should preserve enough context for reconstruction without persisting raw secrets." }
              ]}
            ]},
            { t: "h", x: "Four habits" },
            { t: "list", items: [
              "Load carefully: prefer safetensors or GGUF from reputable sources, avoid untrusted .bin files, do not enable trust_remote_code casually.",
              "Run with boundaries: unprivileged user, containers or sandboxes for agents, disabled network access when offline privacy matters.",
              "Protect secrets: keep credentials out of prompts and RAG indexes, review desktop app telemetry, validate tool calls before execution.",
              "Version what matters: track model, prompt, adapter, runtime, and quantization versions, and log enough for debugging without creating a privacy disaster."
            ]},
            { t: "callout", x: "Local AI security is largely a matter of operational discipline rather than novel cryptography — careful provenance for model files, least-privilege execution, audited tool surfaces, and routine version tracking together cover the majority of realistic threats. The failure modes worth guarding against are mundane: a checkpoint loaded with arbitrary code execution enabled, an agent given filesystem write access it did not need, a telemetry setting overlooked in a desktop application, or an injected instruction in a retrieved document that the agent then acts on." }
          ],
          quiz: [
            { q: "trust_remote_code in Hugging Face Transformers is risky because…",
              a: ["It logs your prompts to Hugging Face", "It lets the model run its own Python code at load time", "It slows inference", "It changes the tokenizer"],
              c: 1,
              e: "A malicious model with trust_remote_code=True can execute arbitrary code on your machine. Default it to False." },
            { q: "Prompt injection is most dangerous when…",
              a: ["The model is offline", "The model has tools that can act on the injected instructions", "The model is small", "The chat template is wrong"],
              c: 1,
              e: "A chatbot that follows injected instructions produces incorrect text. An agent with tools that follows injected instructions executes the injected actions — the blast radius extends to every resource the tools can reach." },
            { q: "'Local' automatically means…",
              a: ["Private", "Secure", "None of the above — local just means you run it yourself", "Cheap"],
              c: 2,
              e: "Local apps can phone home; local files can be malicious; local models can hallucinate. Privacy and security take separate work." }
          ]
        },
        {
          id: "m6l7",
          title: "Open-Weight Does Not Mean Opensource",
          blocks: [
            { t: "p", x: "The phrase \"open model\" is used loosely across the 2026 ecosystem and conflates several distinct categories. Operators evaluating a model for commercial deployment need to distinguish open-weight, source-available, opensource (in the OSI sense), and merely local-compatible — the license terms can differ substantially across these categories even when the model itself is freely downloadable. This is the license-fit check from the Choose a Model That Fits lesson, expanded." },
            { t: "list", items: [
              "Open-weight: the model weights are available for download. The label does not automatically permit commercial use, free modification, training on outputs, deployment above a certain scale, or use without attribution — those terms depend on the specific license attached to the weights.",
              "Source-available: code or weights are visible to the public, but the license may not satisfy the opensource definition. Source-available is a transparency claim, not a usage-rights claim.",
              "Opensource AI: a stronger claim. The Open Source Initiative's Open Source AI Definition treats an AI system as including architecture, parameters and weights, inference code, and enough data information and processing code to derive the parameters. This bar is considerably higher than \"the weights are posted on Hugging Face\" and few widely used 2026 models clear it.",
              "Local-compatible: the model runs on operator-controlled hardware. Independent of license; some restrictively licensed models are perfectly runnable locally for use cases the license forbids."
            ]},
            { t: "p", x: "Some licenses appear permissive on first reading but contain meaningful restrictions: prohibitions on competitive use, prohibitions on training other models from this model's outputs, scale tiers above which a commercial license is required, geographic exclusions, attribution requirements in user-facing surfaces, patent grants or revocations, and copyleft-like obligations that propagate to derivative works. The model card and license file should be read in full before any commercial deployment, not skimmed for the headline." },
            { t: "callout", x: "A model can be excellent, downloadable, and locally runnable while still being legally unsuitable for the intended use. License review belongs in the same pre-deployment checklist as memory math and runtime compatibility — late discovery of a restriction is expensive to remediate after a product has been built around the model." }
          ],
          quiz: [
            { q: "Open-weight means you can…",
              a: ["Use the model however you want commercially", "Modify and redistribute freely", "Download the weights — but commercial use, scale, attribution, etc. may be restricted by the license", "Train on its outputs without any restriction"],
              c: 2,
              e: "Open-weight ≠ opensource. The download is allowed; what you can do with it depends on the specific license." },
            { q: "OSI's Opensource AI Definition requires…",
              a: ["Just downloadable weights", "Just inference code", "Architecture, parameters/weights, inference code, AND enough data information to derive the parameters", "Nothing — any license counts as opensource"],
              c: 2,
              e: "OSI's bar is higher than most so-called 'open' models clear — it includes data information, not just weights." },
            { q: "Before deploying any model commercially, you should…",
              a: ["Just check the leaderboard", "Read the model card and license", "Just trust the README", "Skip license review"],
              c: 1,
              e: "A model can be excellent, downloadable, and locally runnable while still being a bad fit for your legal or deployment constraints." }
          ]
        },
        {
          id: "m6l8",
          title: "Failure Modes and Fixes",
          blocks: [
            { t: "p", x: "Most observed failures in local LLM deployments fall into a small number of predictable categories. The dominant causes are memory fit (covered in Module 3), formatting (Module 2), runtime support (Module 4), decoding settings (Module 1), and retrieval quality (Module 5). The list below maps the most common symptoms to the diagnostic checks that resolve them in practice." },
            { t: "list", items: [
              "Out of memory: weights, KV cache, runtime overhead, or batch concurrency exceed the available memory budget. Diagnostic path: estimate the full memory bill, then reduce model size, lower context length, reduce batch or concurrency, choose a more aggressive quantization, or leave more headroom.",
              "Gibberish or role confusion: the chat template, tokenizer, BOS/EOS tokens, reasoning-mode switch, or tool schema does not match what the model was trained on. Verify the model card and the runtime's template handling before considering it a model-quality issue.",
              "Slow first token: prefill compute dominates time-to-first-token. Diagnostic path: shorten the prompt, enable prefix caching, improve retrieval precision so fewer tokens reach the model, reduce context length, or switch to a runtime with better prefill kernels.",
              "Slow streaming after first token: decode is the bottleneck. Diagnostic path: check memory bandwidth on the deployed hardware, consider more aggressive weight quantization, check for unintended CPU offload spill, verify the attention backend in use, and check whether speculative decoding is supported on this runtime and model.",
              "Bad document answers: retrieval is the typical failure point. Diagnostic path: inspect the parsed text, examine chunk boundaries against the question, verify retrieved metadata, increase top-K, add or improve reranking, and add a grounding check on the final answer.",
              "Bad JSON or tool calls: lower the decoding temperature, apply constrained decoding or grammar enforcement, tighten the schema, provide more representative few-shot examples, and consider a model variant specifically tuned for structured output and tool use.",
              "Repeating loops: reduce temperature or top-p, add a repetition penalty, verify stop tokens are configured correctly, and re-check the chat template — looping commonly traces to a template that fails to terminate generation cleanly."
            ]},
            { t: "callout", x: "The disciplined approach is to start with the routine diagnostic checks — template, memory math, context length, decoding parameters, retrieval quality — before swapping the model. A substantial fraction of apparent model-quality problems resolve at one of these earlier stages, and swapping the model is the most expensive and least informative change that can be made." }
          ],
          quiz: [
            { q: "Out-of-memory errors are most often caused by…",
              a: ["A bad chat template", "Weights, KV cache, runtime overhead, or batch size not fitting", "A tokenizer bug", "A slow decoder"],
              c: 1,
              e: "OOM is a memory math problem. Smaller model, less context, lower batch, or better quant fixes it." },
            { q: "The model produces gibberish or role confusion. First thing to check?",
              a: ["Memory bandwidth", "Chat template, tokenizer, BOS/EOS, reasoning-mode switch, or tool schema", "The GPU drivers", "The OS version"],
              c: 1,
              e: "Format bugs are far more common than model bugs. Verify the template before blaming model quality." },
            { q: "Slow first token usually points to…",
              a: ["Decode bottleneck", "Expensive prefill — shorten the prompt, use prefix caching, improve retrieval", "Quantization too aggressive", "Bad sampling settings"],
              c: 1,
              e: "Time-to-first-token is dominated by prefill. Decode latency shows up in streaming speed after that first token." },
            { q: "Best general approach to debugging weird model behavior?",
              a: ["Immediately try a bigger model", "Start with the boring checks — template, memory, context length, decoding — before swapping models", "Re-train the model", "Restart the GPU"],
              c: 1,
              e: "Routine diagnostic checks resolve a substantial fraction of apparent model failures. A model swap is the most expensive intervention and rarely the right first move." }
          ]
        },
        {
          id: "m6l9",
          title: "Edge Deployment",
          blocks: [
            { t: "p", x: "Small models are increasingly deployable on phones, laptops, robots, IoT gateways, factory and industrial devices, vehicles, medical devices, offline field equipment, and browser-based applications. The edge is not simply a smaller workstation; it operates under a different constraint set — limited memory, limited power budget, thermal limits, intermittent or absent connectivity, strict privacy requirements, real-time latency expectations, short context windows, and the need for predictable fallback behavior when the model cannot answer. The AI PC tier in Module 3 covers the relevant hardware class." },
            { t: "callout", x: "On edge devices the right tradeoff usually favors a small, reliable, predictable model over a larger but more fragile one. Edge failures are operationally expensive — devices are often unattended, dispersed, or offline at the moment of failure — and recovery is harder than on a workstation that an operator can debug interactively." },
            { t: "p", x: "A practical edge configuration commonly combines a 0.5B–4B parameter model, aggressive weight quantization (Q4 or below where quality permits), tightly bounded prompts, fixed output schemas, tool-assisted workflows that compensate for the small model's limitations, on-device embeddings for retrieval, response caching for repeated queries, and trimmed conversation history. When connectivity drops, a local model that continues operating with degraded quality is generally more valuable than a larger model that becomes unreachable." }
          ],
          quiz: [
            { q: "On edge devices, the right tradeoff is usually…",
              a: ["The largest model possible", "A small reliable model that doesn't fail", "A medium model with aggressive Q2 quant", "No quantization at all"],
              c: 1,
              e: "Edge failures are expensive (offline, embedded, real-time). Pick a small model you can trust." },
            { q: "A typical edge LLM setup is closer to…",
              a: ["70B Q4 with 128K context", "0.5B–4B model, tiny prompts, fixed schemas, tool-assisted workflows", "13B FP16 with no tools", "32B unquantized"],
              c: 1,
              e: "Edge wants bounded prompts, structured tasks, aggressive quantization, and helpers that compensate for the small model." },
            { q: "A key edge constraint NOT present on a workstation:",
              a: ["VRAM", "Intermittent connectivity, thermal limits, real-time latency requirements", "Bigger context windows", "Always-on internet"],
              c: 1,
              e: "Workstations don't worry about heat dissipation in a sealed case, a dropped LTE link, or sub-second latency demands." }
          ]
        },
        {
          id: "m6l10",
          title: "How to Grow the Stack",
          blocks: [
            { t: "p", x: "Practitioners typically progress through a recognizable sequence of local-deployment configurations, each appropriate for a different goal and operational maturity level. The progression is not strictly linear — many operators stop at the tier that matches their needs and never advance further — but the tiers map cleanly to skill, scale, and what the deployment is trying to accomplish." },
            { t: "list", items: [
              "Beginner: Harbor or LM Studio, a recent 4B–9B instruct model at Q4 quantization, 8K–32K context, the runtime's built-in chat UI. Goal: develop intuition for prompting, compare candidate models, build a working sense of speed and memory behavior. This tier corresponds to the Your First Local Server lesson in Module 4.",
              "Intermediate: llama.cpp or Hugging Face Transformers, GGUF or safetensors models, an OpenAI-compatible local server, a basic RAG pipeline, a small in-house evaluation set. Goal: build local applications, validate retrieval quality, serve workloads from localhost to a small team. Module 5's RAG lessons become directly applicable at this tier.",
              "Advanced: vLLM or SGLang on one or more GPUs, OpenAI-compatible API exposure, monitoring and observability, prompt and version management, a maintained evaluation suite, RAG with reranking, sandboxed tool use. Goal: serve real users or internal workflows reliably. The production-serving techniques in Module 4 belong here.",
              "Expert: TensorRT-LLM, custom kernels, specialized runtimes, quantization-format experimentation, speculative decoding deployment, multi-GPU parallelism, in-house fine-tuning, model distillation, formal production-evaluation pipelines. Goal: trade engineering investment for inference efficiency and cost reductions at scale that justify the investment."
            ]}
          ],
          quiz: [
            { q: "At the beginner tier, the right tools are usually…",
              a: ["TensorRT-LLM and custom kernels", "Harbor or LM Studio with a 4B–9B instruct model and Q4 quantization", "Multi-GPU vLLM", "A custom PyTorch stack"],
              c: 1,
              e: "Beginner goal: learn prompting, compare models, get a feel for speed and memory. Pick the easiest path." },
            { q: "The intermediate tier introduces…",
              a: ["Production load balancing", "OpenAI-compatible local server + a simple RAG pipeline + small eval set", "Custom CUDA kernels", "Distillation"],
              c: 1,
              e: "Intermediate is about building local apps and testing retrieval — not yet production serving." },
            { q: "The expert tier trades…",
              a: ["Inference quality for cost", "Engineering time for inference efficiency and lower cost at scale", "Nothing — it's just a label", "Hardware cost for quality"],
              c: 1,
              e: "Custom kernels, speculative decoding, quantization experiments cost engineering hours but pay back in efficiency at scale." }
          ]
        },
        {
          id: "m6l11",
          title: "A Local LLM Runbook",
          blocks: [
            { t: "p", x: "This lesson is the final gate the course offers before a local model is trusted with real work. It compresses the course into a checklist organized by deployment phase, with each item connecting back to one or more earlier lessons where the underlying mechanics were established." },
            { t: "list", items: [
              "Choose and fit: select a model family appropriate to the task, read the license in full, confirm hardware requirements, choose a quantization level, and estimate the full memory bill — weights plus KV cache for the target context plus runtime overhead plus batch and concurrency margin plus a safety reserve.",
              "Load and format: prefer safetensors or GGUF from reputable sources, avoid untrusted pickle-based files, verify the tokenizer and chat template against the model card, set context length deliberately, and choose decoding parameters suited to the task.",
              "Evaluate and operate: test against representative prompts drawn from the actual workload, measure time-to-first-token and decode rate, track peak memory at the target context length, validate retrieval before adding RAG to the stack, sandbox tools before adding agents, and consider fine-tuning only after simpler interventions have failed.",
              "Version everything that affects behavior: model, quantization variant, runtime version, prompt templates, chat template, adapters, embedding model, reranker, evaluation set, and hardware profile. Reproducibility is the foundation that makes every other operational practice possible."
            ]},
            { t: "callout", x: "The fundamentals remain constant across model generations, runtime updates, and hardware shifts: a model predicts one token at a time; tokens are not words; weights are one component of a model package among several; chat templates determine whether the model can be invoked at all; the KV cache is a scales-with-context memory term that must be budgeted explicitly; quantization is a quality-against-resources tradeoff; long context is not free in memory or compute; RAG quality is bounded by retrieval quality; fine-tuning requires evaluation discipline to be useful; and a locally running model does not by itself grant privacy or safety — those are engineered on top of the control that local provides." }
          ],
          quiz: [
            { q: "The first runbook step before loading a model is to…",
              a: ["Just start the server", "Pick a model family, read the license, confirm hardware requirements, estimate the full memory bill", "Run benchmarks first", "Skip the license"],
              c: 1,
              e: "Choose and fit comes before load and format. Estimate weights + KV + overhead + batch + safety margin BEFORE downloading." },
            { q: "'Version everything that matters' for local LLMs includes…",
              a: ["Just the model", "Just the prompt", "Model, quantization, runtime, prompt, chat template, adapter, embedding model, reranker, eval set, hardware profile", "Just the OS version"],
              c: 2,
              e: "Local systems are only easier to control when you can reproduce exactly what you ran." },
            { q: "Which of these is the safest model file source habit?",
              a: ["Anything on Hugging Face is fine", "Prefer safetensors or GGUF from reputable sources; avoid untrusted pickle .bin files", "Always use whatever loads fastest", "Trust .bin files from random forums"],
              c: 1,
              e: "Loading pickle-based files runs arbitrary code. safetensors/GGUF from reputable publishers is the baseline." },
            { q: "The fundamentals that DON'T change include…",
              a: ["The model predicts one token at a time", "Chat templates matter", "KV cache is a hidden memory bill", "All of the above"],
              c: 3,
              e: "These are the things that stay true as models, runtimes, and hardware churn around them." }
          ]
        }
      ]
    }
  ],

  glossary: [
    { group: "Model and Tuning Terms", term: "Active Parameters", def: "In a Mixture-of-Experts (MoE) model, the subset of parameters the router actually invokes for a given token. Total parameters drive memory capacity; active parameters drive per-token compute and decode bandwidth. A 600B-total / 30B-active MoE behaves like a 30B model in decode speed while consuming 600B-worth of VRAM." },
    { group: "Model and Tuning Terms", term: "Adapter", def: "A small set of trainable weights added on top of a frozen base model — most commonly the low-rank matrices produced by LoRA. Multiple adapters can be loaded over the same base model and switched per request without reloading the base." },
    { group: "Model and Tuning Terms", term: "Agent", def: "A system in which an LLM is paired with tools it can invoke (file operations, API calls, code execution, browser automation). The safety model differs fundamentally from a chatbot — a hallucinating chatbot produces incorrect text, while a hallucinating agent executes incorrect actions on real resources." },
    { group: "Model and Tuning Terms", term: "Base Model", def: "A pretrained model that has not been fine-tuned for chat or instruction following. Behaves as a raw next-token predictor; instruct and chat models are derived from it by additional training." },
    { group: "Model and Tuning Terms", term: "DPO (Direct Preference Optimization)", def: "A preference-optimization method that trains on pairs of preferred and dispreferred outputs rather than input-output examples. Used to shape model behavior toward chosen response patterns when multiple plausible answers exist." },
    { group: "Model and Tuning Terms", term: "Fine-Tuning", def: "Continued training on top of a pretrained model to shift behavior toward a target task, style, or output format. Distinct from training from scratch. Local operators most commonly use LoRA or QLoRA rather than updating all weights." },
    { group: "Model and Tuning Terms", term: "Hallucination", def: "Content stated confidently by the model that is not grounded in fact. A consequence of next-token sampling over a probability distribution — the model is completing a pattern, not reasoning from verified knowledge. Grounding checks and retrieval reduce, but do not eliminate, hallucination." },
    { group: "Model and Tuning Terms", term: "Instruct Model", def: "A base model fine-tuned to follow instructions and respond conversationally. The default starting point for most local deployments — chat and tool-use workflows assume an instruct or chat variant." },
    { group: "Model and Tuning Terms", term: "LoRA (Low-Rank Adaptation)", def: "A parameter-efficient fine-tuning method that freezes the base model and trains a small correction term factored into two low-rank matrices. Trainable parameter count is typically under 1% of full fine-tuning, and the resulting adapter can be shipped and versioned independently of the base." },
    { group: "Model and Tuning Terms", term: "MoE (Mixture of Experts)", def: "A sparse model architecture in which each layer contains many expert subnetworks, but only a few are activated per token by a learned routing mechanism. Total parameters can be very large while per-token compute scales with active parameters." },
    { group: "Model and Tuning Terms", term: "Multimodal / VLM", def: "A model that accepts inputs beyond text — typically images, sometimes audio or video. Non-text inputs are encoded into token-equivalent vectors that share the model's context budget, so a single high-resolution image can consume thousands of tokens of context." },
    { group: "Model and Tuning Terms", term: "Preference Optimization", def: "A family of fine-tuning methods (DPO, ORPO, IPO, KTO) that train on response-pair preferences rather than input-output examples. Complementary to SFT — SFT teaches what an answer looks like, preference optimization teaches which answer is better." },
    { group: "Model and Tuning Terms", term: "QLoRA", def: "LoRA fine-tuning performed through a base model held in 4-bit quantization. The base stays compressed in memory during training while the LoRA adapter trains at full precision, enabling fine-tuning of much larger base models on consumer hardware." },
    { group: "Model and Tuning Terms", term: "SFT (Supervised Fine-Tuning)", def: "The standard fine-tuning regime: training on a dataset of input-output pairs so the model learns to reproduce the desired output for each input. The default approach when the goal is teaching the model what an answer should look like." },
    { group: "Model and Tuning Terms", term: "Transformer", def: "The model architecture underlying nearly all modern LLMs. Stacks of self-attention and feed-forward (MLP) blocks operate on token sequences, with attention enabling each token to integrate information from previous tokens." },
    { group: "Model and Tuning Terms", term: "Weights / Parameters", def: "The learned numerical values that compose a model. Together with the architecture and tokenizer they fully specify the model's behavior — the package distributed when a model is published." },

    { group: "Inference Mechanics", term: "Attention", def: "The mechanism by which each token integrates information from previous tokens. Each token attends to keys and values produced from earlier positions, weighted by similarity to its query. The dominant per-token compute and memory cost in a Transformer." },
    { group: "Inference Mechanics", term: "BOS / EOS", def: "Beginning-of-sequence and end-of-sequence tokens. Chat templates use these (along with role markers) to delimit system, user, assistant, and tool messages. Wrong BOS/EOS handling is a common cause of role confusion and infinite generation." },
    { group: "Inference Mechanics", term: "Chat Template", def: "The formatting scheme that wraps system, user, assistant, and tool messages with the special tokens the model was trained on. A model invoked without the correct template will produce gibberish, role confusion, or refuse to terminate — getting the template right is a precondition for the model working at all." },
    { group: "Inference Mechanics", term: "Context Window", def: "The maximum number of tokens the model can process in one forward pass, including both the prompt and the tokens generated so far. A nominal ceiling, not a quality guarantee — attention quality often degrades across distance well before the limit." },
    { group: "Inference Mechanics", term: "Decode", def: "The phase that generates output tokens one at a time after prefill has finished processing the prompt. Memory-bandwidth-bound on most hardware — each output token streams the active parameter set through compute once. Decode rate is what end users perceive as the model's speed." },
    { group: "Inference Mechanics", term: "DFlash", def: "A 2026 speculative-decoding approach that uses a block-diffusion model to propose several tokens in parallel. The target model verifies them in one forward pass, producing larger speedups than classic single-token draft-and-verify when acceptance rates are high." },
    { group: "Inference Mechanics", term: "DDTree / DTree", def: "A speculative-decoding variant that builds a tree of candidate draft tokens rather than a linear sequence, and verifies the whole tree in one forward pass. Higher acceptance rate per verification step than a flat draft." },
    { group: "Inference Mechanics", term: "Embedding", def: "A vector representation of text in a high-dimensional space where semantic similarity corresponds to geometric proximity. The output of an embedding model; the substrate that vector search operates on in a RAG pipeline." },
    { group: "Inference Mechanics", term: "GQA / MQA", def: "Grouped-Query Attention and Multi-Query Attention. Attention variants that share keys and values across multiple query heads, substantially reducing KV-cache size and bandwidth pressure relative to vanilla multi-head attention. Standard on most 2026 models." },
    { group: "Inference Mechanics", term: "Inference", def: "Running a trained model to produce outputs against new inputs. Distinct from training (which updates the weights) and from fine-tuning (which continues training on additional data)." },
    { group: "Inference Mechanics", term: "KV Cache", def: "Stored key and value attention states for previously processed tokens. Allows decode to attend to earlier context without recomputing it. The principal scales-with-context memory term — doubles when context doubles and must be budgeted explicitly in VRAM math." },
    { group: "Inference Mechanics", term: "MLA (Multi-head Latent Attention)", def: "DeepSeek's attention variant that compresses the KV cache aggressively while preserving quality. One of the architectural reasons DeepSeek's MoE models are practical to serve at scale." },
    { group: "Inference Mechanics", term: "Prefill", def: "The phase that processes the input prompt before decoding begins. Compute-bound on most hardware — the prompt tokens are batched into parallel matrix multiplies, so prefill speed scales with raw FLOPs rather than memory bandwidth. Sets time-to-first-token." },
    { group: "Inference Mechanics", term: "Prompt Injection", def: "Hostile instructions embedded in content the model is asked to process — a web page, an email, a retrieved document, an OCR'd image. The principal attack surface for any system that consumes external content; agents with tool access are the most exposed." },
    { group: "Inference Mechanics", term: "RoPE (Rotary Position Embeddings)", def: "A positional encoding method that injects position information by rotating query and key vectors in attention space. Standard on most 2026 models. YaRN and related techniques extend RoPE-trained models past their original context length." },
    { group: "Inference Mechanics", term: "Speculative Decoding", def: "A decode-acceleration technique in which a small fast draft model proposes several tokens and the target model verifies them in a single forward pass. When the draft is accurate, the target produces multiple accepted tokens per pass, raising effective tokens-per-second. DFlash and DDTree are 2026 variants." },
    { group: "Inference Mechanics", term: "Token", def: "The unit a tokenizer produces. Typically a subword piece, not a whole word — \"unhappiness\" might tokenize to \"un\", \"happi\", \"ness\". The model operates on token IDs, not characters, so token count (not character count) is what consumes the context window." },
    { group: "Inference Mechanics", term: "Tokenizer", def: "The component that converts text into token IDs the model can process, and converts generated IDs back into text. Each model family ships with a specific tokenizer; using the wrong tokenizer produces silent corruption." },
    { group: "Inference Mechanics", term: "Top-p / Top-k / Temperature", def: "Sampling controls applied during decode. Temperature scales the probability distribution (higher = more diverse, lower = more deterministic); top-k restricts sampling to the K highest-probability tokens; top-p (nucleus sampling) restricts to the smallest set whose cumulative probability exceeds p." },
    { group: "Inference Mechanics", term: "TTFT (Time to First Token)", def: "The latency from request submission to the model producing its first output token. Dominated by prefill compute (proportional to prompt length). Distinct from sustained decode rate, which sets the latency for tokens after the first." },
    { group: "Inference Mechanics", term: "YaRN", def: "A RoPE-extension technique for stretching a model's effective context window past what it was trained for — for example, running a 32K-trained model at 128K. Quality typically degrades at the extended length and the technique is most appropriate as a stopgap." },

    { group: "Retrieval, Files, and Serving", term: "AWQ (Activation-aware Weight Quantization)", def: "A quantization format that uses calibration data to identify which weights are most important to typical activations, preserving those at higher fidelity than a uniform quantization would. Common 4-bit format alongside GPTQ and GGUF K-quants." },
    { group: "Retrieval, Files, and Serving", term: "Chunking", def: "Splitting parsed text into pieces small enough to fit in the model's context alongside other retrieved chunks. The dominant quality lever in RAG — chunks that split sentences or separate claims from their context degrade every downstream stage and cannot be recovered by a better reranker or model." },
    { group: "Retrieval, Files, and Serving", term: "Continuous Batching", def: "A scheduling pattern in which the server adds new requests to a running batch the moment a slot opens, rather than waiting for a fixed batch to assemble. Maintains GPU utilization under variable arrival rates and substantially raises throughput on production serving engines." },
    { group: "Retrieval, Files, and Serving", term: "Embedding Model", def: "A model whose output is a vector representation of input text, used to populate and query a vector index in a RAG pipeline. Distinct from the generation LLM. Common 2026 examples: BGE, E5, GTE, nomic-embed." },
    { group: "Retrieval, Files, and Serving", term: "FP8 KV Cache", def: "Storage of the KV cache in 8-bit floating point rather than 16-bit. Approximately halves cache memory consumption with minimal quality loss on most workloads. Supported in vLLM, SGLang, and other modern serving engines." },
    { group: "Retrieval, Files, and Serving", term: "GGUF", def: "The model file format used by llama.cpp and its derivatives (LM Studio, Ollama). Bundles quantized weights with metadata in a single file. The default format for desktop and consumer-tier local inference." },
    { group: "Retrieval, Files, and Serving", term: "Grounding", def: "Verification that a generated answer is supported by retrieved evidence. A grounding check is an automated test, typically performed by a separate model or rule, that flags answers containing claims not present in the retrieved chunks." },
    { group: "Retrieval, Files, and Serving", term: "Latency Percentiles", def: "p50, p95, and p99 of response times — the median, 95th-percentile, and 99th-percentile latencies in a sample. Percentiles surface tail behavior that averages hide; a workload with an acceptable mean but poor p99 is failing for a measurable fraction of requests." },
    { group: "Retrieval, Files, and Serving", term: "NVFP4", def: "A 4-bit floating-point numeric format accelerated natively on NVIDIA Blackwell-class GPUs. Reduces both weight and activation memory traffic with hardware-level kernel support, materially changing decode performance on supported stacks." },
    { group: "Retrieval, Files, and Serving", term: "Open-weight", def: "A model whose weights are publicly downloadable. Distinct from opensource — the download is permitted, but commercial use, redistribution, scale tier, and other terms depend on the specific license. \"Open-weight\" is not a usage-rights claim." },
    { group: "Retrieval, Files, and Serving", term: "PagedAttention", def: "KV-cache memory management organized into fixed-size pages, analogous to virtual memory in an operating system. Prevents fragmentation and allows the engine to pack many concurrent sequences into a single GPU's memory. Originally introduced by vLLM." },
    { group: "Retrieval, Files, and Serving", term: "Pipeline Parallelism", def: "A parallelism strategy in which different GPUs hold different contiguous ranges of the model's layers, with tokens flowing through the pipeline. Allows large models to be served across multiple GPUs with low per-GPU communication cost but introduces bubble overhead at low batch sizes." },
    { group: "Retrieval, Files, and Serving", term: "Prefix Caching", def: "Reuse of the previously computed KV cache for a shared opening across multiple requests — typically a long system prompt or a multi-turn conversation history. Eliminates redundant prefill work and lowers TTFT for cache hits." },
    { group: "Retrieval, Files, and Serving", term: "Prefill-Decode Disaggregation", def: "An architectural pattern that separates compute-intensive prefill from memory-intensive decode into specialized serving instances, transferring KV cache between them. Prevents long prefill batches from stalling concurrent decode streams. Used by SGLang, TensorRT-LLM, and NVIDIA Dynamo." },
    { group: "Retrieval, Files, and Serving", term: "Quantization", def: "Reducing the numeric precision of model weights (or KV cache, or activations) to lower memory consumption and improve inference speed. Common levels for weights: FP16 / BF16 (2 bytes/param), Q8 (1), Q4 (~0.5), Q3 / Q2 (lower). A tradeoff against quality — math, code, and structured-output reliability degrade first as bit width drops." },
    { group: "Retrieval, Files, and Serving", term: "RAG (Retrieval-Augmented Generation)", def: "A pattern in which the application retrieves relevant chunks from a document corpus at query time and supplies only those chunks to the model, rather than dumping the entire corpus into the prompt. Pipeline stages: ingestion, parsing, chunking, embeddings, vector index, retrieval, reranking, generation, grounding." },
    { group: "Retrieval, Files, and Serving", term: "Reranker", def: "A slower but more accurate model (often a cross-encoder) that re-orders the top-K retrieved chunks by relevance to the query. Frequently the difference between mediocre and good retrieval — but only when the correct chunk is already within the top-K." },
    { group: "Retrieval, Files, and Serving", term: "Safetensors", def: "A tensor serialization format designed to avoid the arbitrary-code-execution risks of pickle-based weight files. The preferred format for trusted weight distribution; pickle-based .bin files from untrusted sources should be avoided." },
    { group: "Retrieval, Files, and Serving", term: "Tensor Parallelism", def: "A parallelism strategy in which each layer's matrix multiplications are partitioned across multiple GPUs that all participate in the same forward pass. Allows a model to exceed one GPU's VRAM at the cost of additional NVLink or PCIe traffic per layer." },
    { group: "Retrieval, Files, and Serving", term: "Tool Use / Tool Calling", def: "A model capability for invoking external functions — file operations, API calls, code execution, database queries — by emitting structured calls that the surrounding system executes. The capability that turns a chatbot into an agent." },
    { group: "Retrieval, Files, and Serving", term: "Vector Index", def: "A database optimized for nearest-neighbor queries over high-dimensional vectors, returning the K closest stored embeddings to a query embedding. Common 2026 implementations: FAISS, Qdrant, Chroma, pgvector, LanceDB." },

    { group: "Hardware and Cost", term: "Capacity vs Bandwidth", def: "The two independent properties of a memory subsystem that local inference depends on. Capacity (GB) decides whether the model fits; bandwidth (GB/s) decides how fast it decodes. A high-capacity low-bandwidth machine (unified memory) and a low-capacity high-bandwidth machine (discrete GPU) win on different workloads." },
    { group: "Hardware and Cost", term: "Capex Amortization", def: "Spreading the up-front hardware purchase price over the equipment's expected useful life when computing per-period cost. One of the four components of local-deployment cost, alongside electricity, operator time, and opportunity cost." },
    { group: "Hardware and Cost", term: "CPU Offload", def: "When a model does not fit in VRAM, spilling some layers to system RAM and streaming them across the PCIe bus per token. Decode speed drops by roughly the ratio of GPU bandwidth to PCIe bandwidth — often an order of magnitude or more. A working escape valve, not a viable strategy for latency-sensitive workloads." },
    { group: "Hardware and Cost", term: "FLOPs / TFLOPS", def: "Floating-point operations per second. The compute-throughput measure for a GPU or accelerator. Governs prefill speed and large-batch decode throughput; less relevant for single-user decode, which is bandwidth-bound rather than compute-bound." },
    { group: "Hardware and Cost", term: "Fragmentation", def: "Free memory chopped into pieces too small to satisfy a larger allocation. A box reporting several GB free may still fail to load a model if the free memory is fragmented. Paged-attention runtimes mitigate this; naive allocators do not." },
    { group: "Hardware and Cost", term: "Hosted API", def: "A paid inference endpoint provided by a model vendor (OpenAI, Anthropic, Google, and others). The alternative to running locally, with a different cost structure — per-token pricing rather than amortized hardware. Often cheaper at low or bursty volume; often more expensive at sustained high throughput." },
    { group: "Hardware and Cost", term: "Hybrid Mamba-Transformer", def: "A model architecture that combines standard Transformer attention blocks with Mamba (state-space) blocks. Mamba layers are linear-time in context length rather than quadratic, making very long context substantially cheaper. Used by Nemotron 3 and other recent architectures." },
    { group: "Hardware and Cost", term: "Memory Bandwidth", def: "The rate at which data moves from a device's memory chips into its compute units, measured in gigabytes per second. Governs single-user decode speed because each output token requires streaming the active parameter set through compute once. Independent of compute throughput (FLOPs)." },
    { group: "Hardware and Cost", term: "Roofline", def: "A first-pass ceiling estimate of decode rate: bandwidth ÷ bytes per forward pass. For a 13B Q4 model (~6.5 GB) on a GPU with 1 TB/s bandwidth, the roofline is approximately 154 tokens per second. Real-world rates fall below the roofline because the KV cache and runtime overhead also consume bandwidth, but the ratio sets the upper bound." },
    { group: "Hardware and Cost", term: "Unified Memory", def: "A memory pool shared between CPU and integrated GPU (Apple Silicon, AMD Strix Halo, some Intel SoCs). The entire system memory budget is available for model weights and KV cache, allowing models that exceed any consumer discrete-GPU VRAM. Typically at lower bandwidth than a high-end discrete GPU." },
    { group: "Hardware and Cost", term: "VRAM", def: "Video RAM on a discrete GPU. Determines what model fits — separate from bandwidth, which determines how fast the fitted model runs. On unified-memory hardware, the equivalent budget is drawn from the shared system memory pool rather than a dedicated VRAM pool." }
  ]
};
