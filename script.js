document.addEventListener('DOMContentLoaded', function() {
    // 初始化变量
    const divider = document.querySelector('.divider');
    const chatSection = document.querySelector('.chat-section');
    const editorSection = document.querySelector('.editor-section');
    const editorContainer = document.querySelector('.editor-container');
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-button');
    const chatMessages = document.querySelector('.chat-messages');
    const overlay = document.querySelector('#sidebarOverlay');
    const documentTitleInput = document.querySelector('.document-title-input');
    
    // 初始化用户名功能
    initUsernameFunctions();
    
    // 添加发布按钮事件处理
    const publishButton = document.querySelector('#publishButton');
    if (publishButton) {
        publishButton.addEventListener('click', function() {
            // 显示发布进度反馈
            this.classList.add('publishing');
            const originalText = this.querySelector('span').textContent;
            this.querySelector('span').textContent = '正在发布...';
            
            // 添加加载动画
            this.querySelector('i').classList.remove('fa-rocket');
            this.querySelector('i').classList.add('fa-spinner', 'fa-spin');
            
            // 模拟发布过程
            setTimeout(() => {
                // 发布完成反馈
                this.classList.remove('publishing');
                this.classList.add('published');
                this.querySelector('span').textContent = '发布成功!';
                this.querySelector('i').classList.remove('fa-spinner', 'fa-spin');
                this.querySelector('i').classList.add('fa-check');
                
                // 显示成功提示
                showPublishSuccessMessage();
                
                // 恢复原来的状态
                setTimeout(() => {
                    this.classList.remove('published');
                    this.querySelector('span').textContent = originalText;
                    this.querySelector('i').classList.remove('fa-check');
                    this.querySelector('i').classList.add('fa-rocket');
                }, 2000);
            }, 1500);
        });
    }
    
    // 显示发布成功消息
    function showPublishSuccessMessage() {
        const successMessage = document.createElement('div');
        successMessage.className = 'publish-success-message';
        successMessage.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <div>
                <h4>发布成功</h4>
                <p>文档已发布至您的个人空间，可立即分享</p>
            </div>
            <button class="close-success-message">
                <i class="fas fa-times"></i>
            </button>
        `;
        document.body.appendChild(successMessage);
        
        // 添加关闭按钮事件
        const closeButton = successMessage.querySelector('.close-success-message');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                successMessage.classList.remove('show');
                setTimeout(() => {
                    successMessage.remove();
                }, 300);
            });
        }
        
        // 添加动画类
        setTimeout(() => {
            successMessage.classList.add('show');
        }, 10);
        
        // 3秒后自动移除消息
        setTimeout(() => {
            successMessage.classList.remove('show');
            setTimeout(() => {
                successMessage.remove();
            }, 300);
        }, 3000);
    }

    // 添加协同编辑变量
    let peerId = null;
    let peer = null;
    let connections = [];
    let isConnected = false;
    let isHost = false;
    let lastUpdateTime = Date.now();
    const UPDATE_THROTTLE = 500; // 节流时间（毫秒）

    // 初始化长消息的折叠/展开功能
    function initializeMessageCollapse() {
        const aiMessages = document.querySelectorAll('.message.ai-message');
        
        aiMessages.forEach(message => {
            const paragraph = message.querySelector('p');
            if (paragraph && paragraph.textContent.length > 80) {
                // 添加折叠类
                message.classList.add('collapsed');
                
                // 如果还没有消息指示器，则添加
                if (!message.querySelector('.message-indicator')) {
                    const messageIndicator = document.createElement('div');
                    messageIndicator.className = 'message-indicator';
                    paragraph.parentNode.insertBefore(messageIndicator, paragraph.nextSibling);
                }
                
                // 如果还没有切换按钮，则添加
                if (!message.querySelector('.toggle-message')) {
                    const toggleButton = document.createElement('button');
                    toggleButton.className = 'toggle-message';
                    toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                    
                    toggleButton.addEventListener('click', function() {
                        const isCollapsed = message.classList.contains('collapsed');
                        
                        // 切换折叠状态
                        message.classList.toggle('collapsed', !isCollapsed);
                        message.classList.toggle('expanded', isCollapsed);
                        
                        // 更新按钮图标
                        this.innerHTML = isCollapsed ? 
                            '<i class="fas fa-chevron-up"></i>' : 
                            '<i class="fas fa-chevron-down"></i>';
                    });
                    
                    // 找到消息时间元素，在它前面插入切换按钮
                    const messageTime = message.querySelector('.message-time');
                    if (messageTime) {
                        message.insertBefore(toggleButton, messageTime);
                    } else {
                        message.appendChild(toggleButton);
                    }
                }
            }
        });
    }

    // 调用初始化函数
    initializeMessageCollapse();

    // 添加 @ 快捷指令功能
    messageInput.addEventListener('input', function(e) {
        const text = this.value;
        // 启用发送按钮如果有文本输入
        sendButton.disabled = !text.trim();
        
        // 检查是否输入了 @
        if (text.includes('@') && !document.querySelector('.ai-commands-popup')) {
            showAICommandsPopup();
        } else if (!text.includes('@') && document.querySelector('.ai-commands-popup')) {
            hideAICommandsPopup();
        }
    });

    // 显示 AI 命令弹出窗口
    function showAICommandsPopup() {
        // 确保没有已存在的弹出窗口
        if (document.querySelector('.ai-commands-popup')) return;
        
        // 创建弹出窗口
        const popup = document.createElement('div');
        popup.className = 'ai-commands-popup';
        popup.innerHTML = `
            <div class="ai-commands-header">智能指令</div>
            <div class="ai-command-item" data-command="优化文案">优化文案</div>
            <div class="ai-command-item" data-command="翻译内容">翻译内容</div>
            <div class="ai-command-item" data-command="总结内容">总结内容</div>
            <div class="ai-command-item" data-command="检查语法">检查语法</div>
            <div class="ai-command-item" data-command="改写文本">改写文本</div>
        `;
        
        // 先添加到页面，这样可以计算尺寸
        document.body.appendChild(popup);
        
        // 定位弹出窗口
        const inputRect = messageInput.getBoundingClientRect();
        const popupHeight = popup.offsetHeight;
        
        // 计算顶部位置，确保不超出屏幕
        let topPosition = inputRect.top - popupHeight - 5;
        if (topPosition < 10) {
            // 如果顶部空间不足，显示在输入框下方
            topPosition = inputRect.bottom + 5;
        }
        
        // 计算左侧位置，确保不超出屏幕
        let leftPosition = inputRect.left;
        if (leftPosition + popup.offsetWidth > window.innerWidth - 10) {
            // 如果右侧空间不足，向左对齐
            leftPosition = window.innerWidth - popup.offsetWidth - 10;
        }
        
        // 应用位置
        popup.style.position = 'fixed';
        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${topPosition}px`;
        
        // 添加命令点击事件
        popup.querySelectorAll('.ai-command-item').forEach(item => {
            item.addEventListener('click', function() {
                const command = this.getAttribute('data-command');
                messageInput.value = `@AI ${command} `;
                messageInput.focus();
                hideAICommandsPopup();
                sendButton.disabled = false;
            });
        });
        
        // 点击外部关闭弹出窗口
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target) && e.target !== messageInput) {
                hideAICommandsPopup();
                document.removeEventListener('click', closePopup);
            }
        });
    }

    // 隐藏 AI 命令弹出窗口
    function hideAICommandsPopup() {
        const popup = document.querySelector('.ai-commands-popup');
        if (popup) {
            popup.remove();
        }
    }

    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        // 如果存在弹窗，在窗口大小变化时隐藏它
        hideAICommandsPopup();
    });
    
    // 添加监听器确保弹窗不会被滚动条影响
    document.addEventListener('scroll', function(e) {
        // 如果有弹窗并且滚动发生在文档或聊天消息容器中，隐藏弹窗
        if (document.querySelector('.ai-commands-popup') && 
            (e.target === document || e.target.classList.contains('chat-messages'))) {
            hideAICommandsPopup();
        }
    }, true);

    // 文档标题相关功能
    if (documentTitleInput) {
        // 从本地存储加载文档标题
        const savedTitle = localStorage.getItem('document-title');
        if (savedTitle) {
            documentTitleInput.value = savedTitle;
            document.title = savedTitle + ' - Smitty AI 编辑器';
        }

        // 保存文档标题
        documentTitleInput.addEventListener('input', function() {
            localStorage.setItem('document-title', this.value);
            // 更新页面标题
            document.title = this.value ? this.value + ' - Smitty AI 编辑器' : 'Smitty AI 编辑器';
        });

        // 如果用户点击回车，移除焦点
        documentTitleInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
    }

    // 配置Quill编辑器
    // 1. 注册自定义字体
    const Font = Quill.import('formats/font');
    Font.whitelist = [
        'sans-serif', 
        'serif', 
        'monospace', 
        'simsun', // 宋体
        'simhei', // 黑体
        'microsoft-yahei', // 微软雅黑
        'arial',
        'times-new-roman'
    ];
    Quill.register(Font, true);

    // 2. 注册自定义字号
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '32px'];
    Quill.register(Size, true);

    // 3. 添加CSS样式以支持中文字体
    const styleElement = document.createElement('style');
    document.head.appendChild(styleElement);
    styleElement.sheet.insertRule('.ql-font-simsun { font-family: SimSun, 宋体, serif; }');
    styleElement.sheet.insertRule('.ql-font-simhei { font-family: SimHei, 黑体, sans-serif; }');
    styleElement.sheet.insertRule('.ql-font-microsoft-yahei { font-family: "Microsoft YaHei", 微软雅黑, sans-serif; }');
    styleElement.sheet.insertRule('.ql-font-arial { font-family: Arial, sans-serif; }');
    styleElement.sheet.insertRule('.ql-font-times-new-roman { font-family: "Times New Roman", serif; }');

    // 4. 创建Quill编辑器实例
    const quill = new Quill('#quill-editor', {
        modules: {
            toolbar: '#quill-toolbar'
        },
        placeholder: '在此处开始编辑...',
        theme: 'snow'
    });

    // 添加选中文本相关变量
    let selectionText = '';
    let selectionMessage = null;
    let selectedRange = null;
    let selectionHighlight = null;  // 新增：用于存储高亮元素

    // 添加魔法选中模式变量
    let magicSelectionMode = true;  // 默认开启

    // 创建粒子爆发特效 - 完全重写
    function createParticleExplosion(e, container, isActive) {
        // 清除现有粒子
        container.innerHTML = '';
        
        // 获取容器的中心位置
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // 添加样式到头部，确保动画关键帧定义存在
        if (!document.getElementById('particle-animation-styles')) {
            const animationStyle = document.createElement('style');
            animationStyle.id = 'particle-animation-styles';
            animationStyle.textContent = `
                @keyframes particleFadeOut {
                    0% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                        filter: blur(0px);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0);
                        filter: blur(4px);
                    }
                }
                
                @keyframes ringExpand {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 0.8;
                        border-width: 2px;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(6);
                        opacity: 0;
                        border-width: 1px;
                    }
                }
                
                @keyframes tinyParticleShoot {
                    0% {
                        transform: translate(-50%, -50%);
                        opacity: 1;
                        width: var(--size);
                        height: var(--size);
                        filter: blur(0px);
                    }
                    50% {
                        opacity: 0.8;
                        filter: blur(1px);
                    }
                    100% {
                        transform: translate(
                            calc(-50% + var(--tx)), 
                            calc(-50% + var(--ty))
                        );
                        opacity: 0;
                        width: calc(var(--size) * 0.5);
                        height: calc(var(--size) * 0.5);
                        filter: blur(2px);
                    }
                }
                
                @keyframes sparkleParticle {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1) rotate(180deg);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.2) rotate(360deg);
                    }
                }
                
                @keyframes floatingParticle {
                    0% {
                        transform: translate(
                            calc(-50% + var(--start-x)), 
                            calc(-50% + var(--start-y))
                        );
                        opacity: 0;
                    }
                    20% {
                        opacity: var(--max-opacity);
                    }
                    80% {
                        opacity: var(--max-opacity);
                    }
                    100% {
                        transform: translate(
                            calc(-50% + var(--end-x)), 
                            calc(-50% + var(--end-y))
                        );
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(animationStyle);
        }
        
        // 创建中心光点
        const centerDot = document.createElement('div');
        centerDot.style.position = 'absolute';
        centerDot.style.left = `${centerX}px`;
        centerDot.style.top = `${centerY}px`;
        centerDot.style.width = '16px';
        centerDot.style.height = '16px';
        centerDot.style.borderRadius = '50%';
        centerDot.style.transform = 'translate(-50%, -50%)';
        centerDot.style.background = isActive ? '#14B8A6' : '#64748B';
        centerDot.style.boxShadow = `0 0 15px ${isActive ? '#14B8A6' : '#64748B'}`;
        centerDot.style.opacity = '1';
        centerDot.style.animation = 'particleFadeOut 1.2s ease-out forwards';
        centerDot.style.pointerEvents = 'none';
        centerDot.style.zIndex = '2';
        container.appendChild(centerDot);
        
        // 创建多层爆发环
        for (let i = 0; i < 3; i++) {
            const ring = document.createElement('div');
            ring.style.position = 'absolute';
            ring.style.left = `${centerX}px`;
            ring.style.top = `${centerY}px`;
            ring.style.width = '20px';
            ring.style.height = '20px';
            ring.style.borderRadius = '50%';
            
            const primaryColor = isActive ? 
                i % 2 === 0 ? 'rgba(20, 184, 166, 0.7)' : 'rgba(56, 189, 248, 0.6)' : 
                i % 2 === 0 ? 'rgba(100, 116, 139, 0.7)' : 'rgba(148, 163, 184, 0.6)';
            
            ring.style.border = `2px solid ${primaryColor}`;
            ring.style.transform = 'translate(-50%, -50%) scale(0)';
            ring.style.animation = `ringExpand 1.5s ${i * 0.2}s ease-out forwards`;
            ring.style.pointerEvents = 'none';
            ring.style.zIndex = '1';
            container.appendChild(ring);
        }
        
        // 创建微小的魔法粒子 - 大量且有不同行为的粒子
        
        // 1. 径向射出的微小粒子 (100个)
        const particleCount = 100;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i;
            const distance = 30 + Math.random() * 70; // 不同距离的粒子
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            
            // 更小的粒子尺寸，从1px到3px不等
            const size = 1 + Math.random() * 2;
            particle.style.setProperty('--size', `${size}px`);
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            particle.style.borderRadius = '50%';
            particle.style.transform = 'translate(-50%, -50%)';
            particle.style.opacity = '0';
            particle.style.pointerEvents = 'none';
            
            // 更多颜色变化
            const colors = isActive ? 
                ['#38BDF8', '#14B8A6', '#0EA5E9', '#0D9488', '#22D3EE', '#06B6D4'] : 
                ['#94A3B8', '#64748B', '#CBD5E1', '#475569', '#E2E8F0', '#F1F5F9'];
                
            const colorIndex = Math.floor(Math.random() * colors.length);
            particle.style.background = colors[colorIndex];
            particle.style.boxShadow = `0 0 2px ${colors[colorIndex]}`;
            
            // 设置自定义属性用于动画
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            
            // 添加动画，更复杂的延迟和时间
            const delay = Math.random() * 0.3;
            const duration = 0.7 + Math.random() * 0.7;
            particle.style.animation = `tinyParticleShoot ${duration}s ${delay}s cubic-bezier(0.25, 0.1, 0.25, 1) forwards`;
            
            container.appendChild(particle);
        }
        
        // 2. 添加闪烁的星星效果 (20个)
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.position = 'absolute';
            
            // 随机位置，但分布在中心周围
            const sparkleDistance = 10 + Math.random() * 40;
            const sparkleAngle = Math.random() * Math.PI * 2;
            const sparkleX = centerX + Math.cos(sparkleAngle) * sparkleDistance;
            const sparkleY = centerY + Math.sin(sparkleAngle) * sparkleDistance;
            
            sparkle.style.left = `${sparkleX}px`;
            sparkle.style.top = `${sparkleY}px`;
            
            // 星星形状
            const starSize = 3 + Math.random() * 4;
            sparkle.style.width = `${starSize}px`;
            sparkle.style.height = `${starSize}px`;
            
            // 星星颜色
            const starColors = isActive ? 
                ['#38BDF8', '#14B8A6', '#0EA5E9', '#22D3EE', '#7DD3FC', '#67E8F9'] : 
                ['#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#F8FAFC', '#FFFFFF'];
            
            const starColor = starColors[Math.floor(Math.random() * starColors.length)];
            
            // 闪烁效果
            if (Math.random() > 0.5) {
                // 圆形闪光
                sparkle.style.borderRadius = '50%';
                sparkle.style.background = starColor;
                sparkle.style.boxShadow = `0 0 4px ${starColor}`;
            } else {
                // 星形闪光
                sparkle.style.background = 'transparent';
                sparkle.style.boxShadow = `0 0 3px ${starColor}`;
                sparkle.style.borderRadius = '0%';
                sparkle.style.transform = 'translate(-50%, -50%) rotate(45deg)';
                
                // 创建星星形状
                sparkle.style.background = starColor;
                sparkle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
            }
            
            // 闪烁动画
            const delay = Math.random() * 0.6;
            const duration = 0.4 + Math.random() * 0.8;
            sparkle.style.animation = `sparkleParticle ${duration}s ${delay}s ease-in-out ${Math.random() > 0.6 ? 'infinite' : '1'}`;
            sparkle.style.animationDirection = Math.random() > 0.5 ? 'normal' : 'reverse';
            
            container.appendChild(sparkle);
        }
        
        // 3. 添加漂浮的魔法尘埃 (25个)
        for (let i = 0; i < 25; i++) {
            const dust = document.createElement('div');
            dust.style.position = 'absolute';
            
            // 起始和结束位置
            const startAngle = Math.random() * Math.PI * 2;
            const endAngle = startAngle + (Math.random() * Math.PI - Math.PI/2);
            
            const startDist = 5 + Math.random() * 15;
            const endDist = 40 + Math.random() * 30;
            
            const startX = Math.cos(startAngle) * startDist;
            const startY = Math.sin(startAngle) * startDist;
            const endX = Math.cos(endAngle) * endDist;
            const endY = Math.sin(endAngle) * endDist;
            
            dust.style.setProperty('--start-x', `${startX}px`);
            dust.style.setProperty('--start-y', `${startY}px`);
            dust.style.setProperty('--end-x', `${endX}px`);
            dust.style.setProperty('--end-y', `${endY}px`);
            
            dust.style.left = `${centerX}px`;
            dust.style.top = `${centerY}px`;
            
            // 尘埃形状和颜色
            const dustSize = 0.8 + Math.random() * 1.5;
            dust.style.width = `${dustSize}px`;
            dust.style.height = `${dustSize}px`;
            dust.style.borderRadius = '50%';
            
            const dustColors = isActive ? 
                ['rgba(20, 184, 166, 0.9)', 'rgba(56, 189, 248, 0.9)', 'rgba(14, 165, 233, 0.8)', 'rgba(6, 182, 212, 0.8)'] : 
                ['rgba(148, 163, 184, 0.8)', 'rgba(203, 213, 225, 0.8)', 'rgba(226, 232, 240, 0.8)', 'rgba(241, 245, 249, 0.8)'];
            
            const dustColor = dustColors[Math.floor(Math.random() * dustColors.length)];
            dust.style.background = dustColor;
            dust.style.boxShadow = `0 0 3px ${dustColor}`;
            
            // 设置最大不透明度，有些尘埃更透明
            const maxOpacity = 0.6 + Math.random() * 0.4;
            dust.style.setProperty('--max-opacity', maxOpacity);
            
            // 动画
            const duration = 1 + Math.random() * 1.2;
            const delay = Math.random() * 0.6;
            dust.style.animation = `floatingParticle ${duration}s ${delay}s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
            
            container.appendChild(dust);
        }
        
        // 延长清理时间，确保所有动画完成
        setTimeout(() => {
            container.innerHTML = '';
        }, 2500);
    }

    // 创建魔法选中模式切换按钮
    function createMagicSelectionButton() {
        // 首先检查是否已有协同编辑按钮作为参考
        const collaborationBtn = document.getElementById('collaborationBtn');
        if (!collaborationBtn) {
            console.error('找不到协同编辑按钮，魔选按钮将使用发布文档按钮作为参考');
            
            // 替代方案：尝试查找顶部工具栏或发布文档按钮
            const publishBtn = document.querySelector('[data-action="publish"]') || 
                               document.querySelector('.publish-button') || 
                               document.querySelector('button:has(i.fas.fa-rocket)');
            
            const topToolbar = document.querySelector('.top-toolbar') || 
                               document.querySelector('.ql-toolbar-container') || 
                               document.querySelector('.document-actions');
            
            if (publishBtn) {
                // 找到了发布按钮，在其左侧添加魔选按钮
                addMagicButton(publishBtn, 'beforebegin');
            } else if (topToolbar) {
                // 找到了顶部工具栏，在尾部添加魔选按钮
                addMagicButton(topToolbar, 'append');
            } else {
                // 最后尝试使用Quill工具栏
                const quillToolbar = document.querySelector('.ql-toolbar');
                if (!quillToolbar) {
                    console.error('找不到任何合适的位置放置魔选按钮');
                    return;
                }
                addMagicButton(quillToolbar, 'append');
            }
            return;
        }
        
        // 使用协同编辑按钮作为参考
        addMagicButton(collaborationBtn, 'afterend');
        
        // 内部函数：添加魔选按钮
        function addMagicButton(referenceElement, position) {
            // 检查是否已存在魔选按钮
            if (document.querySelector('.magic-selection-toggle')) {
                document.querySelector('.magic-selection-toggle').remove();
            }
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'magic-selection-toggle';
            buttonContainer.id = 'magicSelectionToggle';
            
            // 设置按钮容器样式，与参考元素保持一致
            if (position === 'afterend' || position === 'beforebegin') {
                buttonContainer.style.display = 'inline-flex';
                buttonContainer.style.verticalAlign = 'middle';
            } else {
                buttonContainer.style.display = 'inline-block';
            }
            
            buttonContainer.style.marginLeft = '5px';
            buttonContainer.style.position = 'relative';
            
            buttonContainer.innerHTML = `
                <button class="magic-selection-button active">
                    <i class="fas fa-wand-magic-sparkles"></i>
                    <span>魔选</span>
                </button>
                <div class="magic-button-particles" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: visible; pointer-events: none;"></div>
            `;
            
            // 根据指定位置添加按钮
            if (position === 'afterend') {
                referenceElement.insertAdjacentElement('afterend', buttonContainer);
            } else if (position === 'beforebegin') {
                referenceElement.insertAdjacentElement('beforebegin', buttonContainer);
            } else if (position === 'append') {
                referenceElement.appendChild(buttonContainer);
            }
            
            // 复制参考元素的部分样式以保持一致性
            try {
                const refStyle = window.getComputedStyle(referenceElement);
                const button = buttonContainer.querySelector('.magic-selection-button');
                
                // 仅复制关键样式
                button.style.height = refStyle.height;
                button.style.fontSize = refStyle.fontSize;
                button.style.fontFamily = refStyle.fontFamily;
                button.style.borderRadius = refStyle.borderRadius;
            } catch (e) {
                console.warn('无法复制参考元素样式', e);
            }
            
            // 添加样式
            if (!document.getElementById('magic-selection-styles')) {
                const buttonStyle = document.createElement('style');
                buttonStyle.id = 'magic-selection-styles';
                buttonStyle.textContent = `
                    .magic-selection-button {
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        padding: 6px 10px;
                        background: rgba(241, 245, 249, 0.9);
                        border: none;
                        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                        color: #64748b;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                        z-index: 2;
                        backdrop-filter: blur(4px);
                        -webkit-backdrop-filter: blur(4px);
                    }
                    
                    .magic-selection-button span {
                        white-space: nowrap;
                        display: inline-block;
                        transition: transform 0.2s ease;
                    }
                    
                    .magic-selection-button:hover {
                        color: #334155;
                        background-color: rgba(241, 245, 249, 0.95);
                        box-shadow: 0 4px 6px rgba(15, 23, 42, 0.1);
                        transform: translateY(-1px);
                    }
                    
                    .magic-selection-button:active {
                        transform: translateY(1px);
                        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
                    }
                    
                    .magic-selection-button.active {
                        color: #0d9488;
                        background: rgba(240, 253, 250, 0.9);
                        box-shadow: 0 2px 8px rgba(20, 184, 166, 0.2);
                    }
                    
                    .magic-selection-button.active:hover {
                        background: rgba(240, 253, 250, 0.95);
                        box-shadow: 0 4px 10px rgba(20, 184, 166, 0.25);
                    }
                    
                    .magic-selection-button.locked {
                        pointer-events: none;
                        opacity: 0.7;
                    }
                    
                    .magic-selection-button i {
                        font-size: 14px;
                        transition: transform 0.3s ease;
                    }
                    
                    .magic-selection-button:hover i {
                        transform: rotate(15deg);
                    }
                    
                    .magic-selection-button.active i {
                        color: #14b8a6;
                        text-shadow: 0 0 8px rgba(20, 184, 166, 0.3);
                    }
                    
                    @media (max-width: 768px) {
                        .magic-selection-button span {
                            display: none;
                        }
                        
                        .magic-selection-button {
                            padding: 6px;
                        }
                    }
                `;
                document.head.appendChild(buttonStyle);
            }
            
            // 绑定点击事件
            const button = buttonContainer.querySelector('.magic-selection-button');
            const particles = buttonContainer.querySelector('.magic-button-particles');
            
            // 按钮锁定状态
            let isButtonLocked = false;
            
            button.addEventListener('click', function() {
                // 如果按钮已锁定，忽略点击
                if (isButtonLocked) return;
                
                // 锁定按钮
                isButtonLocked = true;
                button.classList.add('locked');
                
                // 更新魔法选中模式
                magicSelectionMode = !magicSelectionMode;
                this.classList.toggle('active', magicSelectionMode);
                
                // 如果关闭魔法选中，移除当前高亮
                if (!magicSelectionMode) {
                    removeHighlight();
                } else if (selectedRange) {
                    // 如果已有选中内容，应用魔法效果
                    createHighlight(selectedRange);
                }
                
                // 为按钮添加点击时的微小缩放效果
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                // 创建粒子爆发特效，使用合成事件确保特效显示在按钮中心
                createParticleExplosion({ clientX: 0, clientY: 0 }, particles, magicSelectionMode);
                
                // 特效完成后解锁按钮（2.5秒，确保特效完整播放）
                setTimeout(() => {
                    isButtonLocked = false;
                    button.classList.remove('locked');
                }, 2500);
            });
        }
    }

    // 初始化时创建按钮
    createMagicSelectionButton();

    // 创建高亮效果
    function createHighlight(range) {
        // 如果不是魔法选中模式，不创建高亮
        if (!magicSelectionMode) return;
        
        // 移除之前的高亮
        removeHighlight();
        
        // 获取选中文本的位置信息
        const bounds = quill.getBounds(range.index, range.length);
        
        // 创建高亮元素
        selectionHighlight = document.createElement('div');
        selectionHighlight.className = 'selection-highlight magic-highlight';
        selectionHighlight.style.position = 'absolute';
        selectionHighlight.style.top = bounds.top + 'px';
        selectionHighlight.style.left = bounds.left + 'px';
        selectionHighlight.style.width = bounds.width + 'px';
        selectionHighlight.style.height = bounds.height + 'px';
        
        // 添加流动光效背景
        const flowBackground = document.createElement('div');
        flowBackground.className = 'flow-background';
        selectionHighlight.appendChild(flowBackground);
        
        // 添加魔法流动线条
        for (let i = 0; i < 5; i++) {
            const flowLine = document.createElement('div');
            flowLine.className = 'flow-line';
            flowLine.style.animationDelay = `${i * 0.4}s`;
            selectionHighlight.appendChild(flowLine);
        }
        
        // 添加内部脉冲效果
        const innerPulse = document.createElement('div');
        innerPulse.className = 'inner-pulse';
        selectionHighlight.appendChild(innerPulse);
        
        // 添加内边框脉冲效果
        const pulseBorder = document.createElement('div');
        pulseBorder.className = 'pulse-border';
        selectionHighlight.appendChild(pulseBorder);
        
        // 添加多层脉冲光环
        for (let i = 0; i < 4; i++) {
            const pulseHalo = document.createElement('div');
            pulseHalo.className = `pulse-halo-${i+1}`;
            pulseHalo.style.animationDelay = `${i * 0.15}s`;
            selectionHighlight.appendChild(pulseHalo);
        }
        
        // 添加到编辑器容器
        document.querySelector('.ql-container').appendChild(selectionHighlight);
    }

    // 移除高亮效果
    function removeHighlight() {
        if (selectionHighlight) {
            selectionHighlight.remove();
            selectionHighlight = null;
        }
    }

    // 监听编辑器选择事件
    quill.on('selection-change', function(range, oldRange, source) {
        // 仅在魔法选中模式下处理文本选择
        if (range && range.length > 0 && magicSelectionMode) {
            // 有文本被选中且是魔法选中模式
            selectionText = quill.getText(range.index, range.length);
            selectedRange = {
                index: range.index,
                length: range.length
            };
            
            // 创建高亮效果
            createHighlight(range);
            
            // 更新输入框提示
            messageInput.placeholder = `请输入修改要求...`;
            
            // 更新或创建选中提示消息
            if (!selectionMessage) {
                selectionMessage = document.createElement('div');
                selectionMessage.className = 'message system-message';
                chatMessages.appendChild(selectionMessage);
            }
            
            selectionMessage.innerHTML = `
                <p>您已选中以下文本：</p>
                <div class="selected-text">${selectionText}</div>
                <p class="hint">请输入您想要对这段文本进行的修改要求</p>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // 自动聚焦到输入框
            messageInput.focus();
            
            // 清除实际的选中状态，但保持视觉效果
            setTimeout(() => {
                quill.setSelection(null);
            }, 0);
        } else if (source === 'user' && !range && !messageInput.matches(':focus')) {
            // 如果是用户点击编辑器其他区域，且输入框不是焦点，清除选中状态
            clearSelection();
        }
    });
    
    // 创建清除选中状态的函数
    function clearSelection() {
        if (selectedRange) {
            removeHighlight();
            selectedRange = null;
            selectionText = '';
            messageInput.placeholder = '输入 @ 触发智能指令...';
            
            if (selectionMessage) {
                selectionMessage.remove();
                selectionMessage = null;
            }
        }
    }

    // 监听编辑器区域的点击事件
    editorSection.addEventListener('click', function(e) {
        // 如果点击的是编辑器区域的空白处，才清除选中状态
        if ((e.target === editorSection || e.target.classList.contains('ql-container')) && 
            !messageInput.matches(':focus') && magicSelectionMode) {
            clearSelection();
        }
    });
    
    // 监听编辑器内容变化事件
    quill.on('text-change', function() {
        // 如果编辑器内容发生变化，且不是应用AI结果的操作，清除选中状态
        if (selectedRange && !window.isApplyingAIResponse) {
            clearSelection();
        }
    });

    // 监听文档点击事件，处理点击其他区域的情况
    document.addEventListener('mousedown', function(e) {
        // 如果点击的不是消息输入框、聊天区域、编辑器区域，也不是已有的高亮区域
        const isClickingEditor = editorSection.contains(e.target);
        const isClickingChat = chatSection.contains(e.target);
        const isClickingHighlight = selectionHighlight && selectionHighlight.contains(e.target);
        
        if (!isClickingEditor && !isClickingChat && !isClickingHighlight) {
            clearSelection();
        }
    });

    // 初始化编辑器内容
    quill.setContents([
        { insert: '产品概述\n' },
        { insert: 'Smitty AI 编辑器是一款革命性的智能写作工具，它将彻底改变您的创作方式。\n' },
        { insert: '通过先进的人工智能技术，我们为用户提供实时写作建议、智能内容优化以及多样化的写作模板。\n' },
        { insert: '独特的双屏设计让您的写作过程更加流畅，左侧的 AI 对话随时为您提供帮助，右侧的编辑区域让您专注于内容创作。\n' },
        { insert: '核心功能\n' },
        { insert: '• 智能写作建议\n• 实时语法检查\n• 多人协作功能\n• 版本控制系统\n• 自定义模板库\n' }
    ]);
    
    // 标记编辑器内容为初始状态
    let isInitialContent = true;
    
    // 监听编辑器变化，首次输入时清空内容
    quill.on('text-change', function(delta, oldDelta, source) {
        if (isInitialContent && source === 'user') {
            // 只有当用户输入时才清空，而不是程序改变内容时
            isInitialContent = false;
            // 延迟清空操作，让用户先看到自己的输入，然后再清空
            setTimeout(() => {
                quill.setText('');
                
                // 显示提示信息
                if (!document.querySelector('.editor-hint')) {
                    const hint = document.createElement('div');
                    hint.className = 'editor-hint';
                    hint.textContent = '示例内容已清空，请开始您的创作';
                    document.querySelector('.editor-wrapper').appendChild(hint);
                    
                    // 5秒后隐藏提示
                    setTimeout(() => {
                        hint.classList.add('hidden');
                        setTimeout(() => hint.remove(), 500);
                    }, 5000);
                }
            }, 10);
        }
    });

    // 保存默认框架大小
    const defaultSizes = {
        chatSection: {
            width: chatSection.offsetWidth,
            percentage: (chatSection.offsetWidth / editorContainer.offsetWidth) * 100
        },
        editorSection: {
            width: editorSection.offsetWidth,
            percentage: (editorSection.offsetWidth / editorContainer.offsetWidth) * 100
        }
    };

    // 分隔条拖动功能
    let isDragging = false;
    let startX;
    let startWidth;

    divider.addEventListener('mousedown', function(e) {
        isDragging = true;
        startX = e.clientX;
        startWidth = chatSection.offsetWidth;
        
        document.body.style.cursor = 'col-resize';
        divider.style.background = '#15B8A6';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const width = startWidth + (e.clientX - startX);
        const containerWidth = document.querySelector('.editor-container').offsetWidth;
        
        // 限制最小和最大宽度
        const minWidth = 300;
        const maxWidth = containerWidth - 300;
        
        if (width >= minWidth && width <= maxWidth) {
            chatSection.style.width = `${width}px`;
            editorSection.style.width = `${containerWidth - width}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        document.body.style.cursor = '';
        divider.style.background = 'linear-gradient(to bottom, transparent, #E2E8F0, transparent)';
    });

    // 设置星火API回调函数
    window.sparkAPI.setResponseCallback(handleSparkResponse);

    // 处理星火API响应
    function handleSparkResponse(message, type, isComplete) {
        if (type === 'error') {
            // 显示错误消息
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message ai-message error';
            errorMessage.innerHTML = `
                <p>${message}</p>
                <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            chatMessages.appendChild(errorMessage);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }

        // 查找或创建AI响应消息
        let aiMessage = chatMessages.querySelector('.message.ai-message.pending');
        
        if (!aiMessage) {
            // 创建新的AI消息
            aiMessage = document.createElement('div');
            aiMessage.className = 'message ai-message pending';
            aiMessage.innerHTML = `
                <p></p>
                <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            chatMessages.appendChild(aiMessage);
        }
        
        // 更新消息内容
        const paragraph = aiMessage.querySelector('p');
        paragraph.textContent = message;
        
        // 如果消息完成，移除pending类
        if (isComplete) {
            aiMessage.classList.remove('pending');
            
            // 添加折叠功能 - 如果文本超过80字符
            if (message.length > 80) {
                // 添加折叠类
                aiMessage.classList.add('collapsed');
                
                // 添加内容指示器（渐变效果）
                const messageIndicator = document.createElement('div');
                messageIndicator.className = 'message-indicator';
                paragraph.parentNode.insertBefore(messageIndicator, paragraph.nextSibling);
                
                // 添加折叠/展开按钮
                const toggleButton = document.createElement('button');
                toggleButton.className = 'toggle-message';
                toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                toggleButton.addEventListener('click', function() {
                    const isCollapsed = aiMessage.classList.contains('collapsed');
                    
                    // 切换折叠状态
                    aiMessage.classList.toggle('collapsed', !isCollapsed);
                    aiMessage.classList.toggle('expanded', isCollapsed);
                    
                    // 更新按钮图标
                    this.innerHTML = isCollapsed ? 
                        '<i class="fas fa-chevron-up"></i>' : 
                        '<i class="fas fa-chevron-down"></i>';
                });
                
                // 添加到消息
                aiMessage.appendChild(toggleButton);
            }
            
            // 创建应用到编辑器按钮 - 无论是否有选中的文本都显示
            if (!aiMessage.querySelector('.apply-to-editor')) {
                const applyButton = document.createElement('button');
                applyButton.className = 'apply-to-editor';
                applyButton.innerHTML = `
                    <div class="button-content">
                        <i class="fas fa-pen"></i>
                        <span>应用到编辑器</span>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                `;
                applyButton.addEventListener('click', () => {
                    // 检查是否有魔法选中的内容
                    if (magicSelectionMode && selectedRange) {
                        // 标记正在应用AI响应
                        window.isApplyingAIResponse = true;
                        
                        // 替换对应的选中文本
                        quill.deleteText(selectedRange.index, selectedRange.length);
                        quill.insertText(selectedRange.index, message);
                        
                        // 清除选中状态
                        clearSelection();
                        
                        // 重置标记
                        setTimeout(() => {
                            window.isApplyingAIResponse = false;
                        }, 100);
                    } else {
                        // 如果没有选中文本，插入到当前光标位置
                        if (isInitialContent) {
                            isInitialContent = false;
                            quill.setText('');
                        }
                        
                        const range = quill.getSelection(true);
                        if (range && range.length > 0) {
                            quill.deleteText(range.index, range.length);
                            quill.insertText(range.index, message);
                        } else if (range) {
                            quill.insertText(range.index, message);
                        } else {
                            quill.insertText(quill.getLength() - 1, '\n' + message);
                        }
                    }
                    
                    // 显示提示
                    const feedbackMsg = document.createElement('div');
                    feedbackMsg.className = 'apply-feedback';
                    feedbackMsg.textContent = '内容已应用到编辑器';
                    feedbackMsg.style.position = 'fixed';
                    feedbackMsg.style.bottom = '20px';
                    feedbackMsg.style.left = '50%';
                    feedbackMsg.style.transform = 'translateX(-50%)';
                    feedbackMsg.style.backgroundColor = '#14B8A6';
                    feedbackMsg.style.color = 'white';
                    feedbackMsg.style.padding = '8px 16px';
                    feedbackMsg.style.borderRadius = '4px';
                    feedbackMsg.style.zIndex = '1000';
                    feedbackMsg.style.opacity = '0';
                    feedbackMsg.style.transition = 'opacity 0.3s';
                    
                    document.body.appendChild(feedbackMsg);
                    
                    setTimeout(() => {
                        feedbackMsg.style.opacity = '1';
                    }, 10);
                    
                    setTimeout(() => {
                        feedbackMsg.style.opacity = '0';
                        setTimeout(() => {
                            feedbackMsg.remove();
                        }, 300);
                    }, 2000);
                });
                aiMessage.appendChild(applyButton);
            }
        }
        
        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 聊天功能
    messageInput.addEventListener('input', function() {
        sendButton.disabled = !this.value.trim();
    });

    // 添加键盘事件监听
    messageInput.addEventListener('keydown', function(e) {
        // 当用户输入 @ 符号时
        if (e.key === '@') {
            setTimeout(() => {
                if (!document.querySelector('.ai-commands-popup')) {
                    showAICommandsPopup();
                }
            }, 0);
        }
    });

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // 添加用户消息
        const userMessage = document.createElement('div');
        userMessage.className = 'message user-message';
        
        // 只有在魔法选中模式下才显示"基于选中文本的修改要求"
        const selectionContext = (magicSelectionMode && selectedRange) 
            ? '<div class="selection-context">基于选中文本的修改要求</div>' 
            : '';
            
        userMessage.innerHTML = `
            <p>${message}</p>
            ${selectionContext}
            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatMessages.appendChild(userMessage);

        // 清空输入框
        messageInput.value = '';
        sendButton.disabled = true;

        try {
            // 只有在魔法选中模式下才将选中文本添加到消息中
            const fullMessage = (magicSelectionMode && selectedRange) 
                ? `针对以下文本：\n${selectionText}\n\n用户要求：${message}`
                : message;
                
            // 发送消息到星火API
            await window.sparkAPI.sendMessage(fullMessage);
        } catch (error) {
            console.error('发送消息失败:', error);
            handleSparkResponse('发送消息失败，请稍后再试', 'error');
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 初始滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 版本控制功能
    class VersionControl {
        constructor(quill) {
            this.versions = {};
            this.currentVersion = null;
            this.selectedVersion = null;
            this.quill = quill;
            
            // DOM 元素
            this.sidebar = document.getElementById('versionSidebar');
            this.comparePanel = document.getElementById('comparePanel');
            this.overlay = document.getElementById('sidebarOverlay');
            this.versionList = document.getElementById('versionList');
            this.currentVersionContent = document.getElementById('currentVersionContent');
            this.selectedVersionContent = document.getElementById('selectedVersionContent');
            
            // 按钮
            this.versionsBtn = document.querySelector('[data-action="versions"]');
            this.closeVersionBtn = document.getElementById('closeVersionBtn');
            this.closeCompareBtn = document.getElementById('closeCompareBtn');
            this.compareBtn = document.getElementById('compareBtn');
            this.rollbackBtn = document.getElementById('rollbackBtn');
            
            this.init();
        }
        
        init() {
            // 初始化第一个版本
            this.addVersion({
                content: this.quill.getContents(),
                type: 'initial',
                description: '初始版本',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            
            // 绑定事件
            this.bindEvents();
        }
        
        bindEvents() {
            // 打开版本面板
            this.versionsBtn?.addEventListener('click', () => this.openSidebar());
            
            // 关闭按钮
            this.closeVersionBtn?.addEventListener('click', () => this.closeSidebar());
            this.closeCompareBtn?.addEventListener('click', () => this.closeComparePanel());
            
            // 遮罩层点击
            this.overlay?.addEventListener('click', () => this.closeAll());
            
            // ESC 键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeAll();
            });
            
            // 版本对比
            this.compareBtn?.addEventListener('click', () => this.compareVersions());
            
            // 版本回滚
            this.rollbackBtn?.addEventListener('click', () => this.rollbackVersion());
            
            // 监听编辑器变化，自动创建版本
            this.quill.on('text-change', this.debounce(() => {
                this.addVersion({
                    content: this.quill.getContents(),
                    type: 'user',
                    description: '自动保存',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }, 3000));
        }
        
        debounce(func, delay) {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }
        
        openSidebar() {
            this.sidebar.classList.add('active');
            this.overlay.classList.add('active');
        }
        
        closeSidebar() {
            this.sidebar.classList.remove('active');
            this.comparePanel.classList.remove('active');
            this.overlay.classList.remove('active');
        }
        
        closeComparePanel() {
            this.comparePanel.classList.remove('active');
        }
        
        closeAll() {
            this.closeSidebar();
            this.closeComparePanel();
        }
        
        addVersion(version) {
            const versionId = `v${Object.keys(this.versions).length + 1}`;
            this.versions[versionId] = version;
            this.currentVersion = versionId;
            
            // 创建版本项
            const versionItem = document.createElement('div');
            versionItem.className = 'version-item';
            versionItem.dataset.version = versionId;
            versionItem.innerHTML = `
                <div class="version-type ${version.type}">${version.type === 'ai' ? 'AI 修改' : version.type === 'initial' ? '初始版本' : '用户修改'}</div>
                <div>${version.description}</div>
                <div class="version-info">${version.time}</div>
            `;
            
            // 点击选择版本
            versionItem.addEventListener('click', () => {
                this.selectVersion(versionId);
            });
            
            // 添加到列表
            this.versionList.insertBefore(versionItem, this.versionList.firstChild);
            
            return versionId;
        }
        
        selectVersion(versionId) {
            // 更新选中状态
            this.versionList.querySelectorAll('.version-item').forEach(item => {
                item.classList.toggle('active', item.dataset.version === versionId);
            });
            
            this.selectedVersion = versionId;
        }
        
        compareVersions() {
            if (!this.selectedVersion || this.selectedVersion === this.currentVersion) {
                alert('请选择要对比的版本');
                return;
            }
            
            const currentVersion = this.versions[this.currentVersion];
            const selectedVersion = this.versions[this.selectedVersion];
            
            // 临时创建编辑器来渲染内容
            const tempDiv1 = document.createElement('div');
            document.body.appendChild(tempDiv1);
            const tempEditor1 = new Quill(tempDiv1);
            tempEditor1.setContents(currentVersion.content);
            
            const tempDiv2 = document.createElement('div');
            document.body.appendChild(tempDiv2);
            const tempEditor2 = new Quill(tempDiv2);
            tempEditor2.setContents(selectedVersion.content);
            
            this.currentVersionContent.innerHTML = tempDiv1.querySelector('.ql-editor').innerHTML;
            this.selectedVersionContent.innerHTML = tempDiv2.querySelector('.ql-editor').innerHTML;
            
            // 清理
            document.body.removeChild(tempDiv1);
            document.body.removeChild(tempDiv2);
            
            this.comparePanel.classList.add('active');
        }
        
        rollbackVersion() {
            if (!this.selectedVersion || this.selectedVersion === this.currentVersion) {
                alert('请选择要回滚的版本');
                return;
            }
            
            if (confirm('确定要回滚到此版本吗？当前版本将被保存为新版本。')) {
                // 保存当前版本
                this.addVersion({
                    content: this.quill.getContents(),
                    type: 'user',
                    description: '回滚前的版本',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                
                // 回滚到选中版本
                this.quill.setContents(this.versions[this.selectedVersion].content);
                this.currentVersion = this.selectedVersion;
                
                // 关闭面板
                this.closeAll();
            }
        }
    }

    // 文档编辑功能
    class DocumentEditor {
        constructor(quill) {
            this.quill = quill;
            this.fileInput = document.getElementById('fileInput');
            this.importBtn = document.getElementById('importBtn');
            this.exportBtn = document.getElementById('exportBtn');
            
            // 创建协同编辑按钮而不是修改导出按钮
            this.createCollaborationButton();
            
            this.bindEvents();
            this.setupKeyboardShortcuts();
        }
        
        // 创建协同编辑按钮
        createCollaborationButton() {
            // 寻找导出按钮作为参考
            const exportBtn = document.getElementById('exportBtn');
            if (!exportBtn) {
                console.error('找不到导出按钮');
                return;
            }
            
            // 获取导出按钮的父元素
            const parentElement = exportBtn.parentElement;
            if (!parentElement) {
                console.error('找不到导出按钮的父元素');
                return;
            }
            
            // 创建协同编辑按钮
            const collaborationBtn = document.createElement('button');
            collaborationBtn.id = 'collaborationBtn';
            collaborationBtn.className = 'action-button collaboration-btn';
            collaborationBtn.innerHTML = '<i class="fas fa-users"></i>';
            collaborationBtn.setAttribute('title', '协同编辑');
            
            // 复制导出按钮的样式
            const exportBtnComputedStyle = window.getComputedStyle(exportBtn);
            collaborationBtn.style.fontSize = exportBtnComputedStyle.fontSize;
            collaborationBtn.style.padding = exportBtnComputedStyle.padding;
            collaborationBtn.style.border = exportBtnComputedStyle.border;
            collaborationBtn.style.background = exportBtnComputedStyle.background;
            collaborationBtn.style.color = exportBtnComputedStyle.color;
            collaborationBtn.style.cursor = 'pointer';
            collaborationBtn.style.marginLeft = '5px';
            
            // 在导出按钮后面添加协同编辑按钮
            exportBtn.insertAdjacentElement('afterend', collaborationBtn);
            
            // 绑定点击事件
            collaborationBtn.addEventListener('click', () => {
                this.showCollaborationDialog();
            });
        }
        
        bindEvents() {
            // 导入按钮点击
            this.importBtn?.addEventListener('click', () => {
                this.fileInput.click();
            });
            
            // 文件选择变化
            this.fileInput?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importDocument(file);
                }
            });
            
            // 导出按钮点击
            this.exportBtn?.addEventListener('click', () => {
                this.exportDocument();
            });
        }
        
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + S: 导出
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.exportDocument();
                }
                
                // Ctrl/Cmd + O: 导入
                if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                    e.preventDefault();
                    this.fileInput.click();
                }
            });
        }
        
        async importDocument(file) {
            try {
                const content = await this.readFile(file);
                
                // 创建新版本
                versionControl.addVersion({
                    content: this.quill.getContents(),
                    type: 'user',
                    description: '导入前的版本',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                
                // 更新编辑器内容
                if (file.name.endsWith('.txt')) {
                    // 处理纯文本
                    this.quill.setText(content);
                } else if (file.name.endsWith('.html')) {
                    // 处理HTML
                    this.quill.clipboard.dangerouslyPasteHTML(content);
                } else if (file.name.endsWith('.md')) {
                    // 处理Markdown
                    this.quill.setText(content);
                } else {
                    // 其他格式作为纯文本处理
                    this.quill.setText(content);
                }
                
                // 创建导入版本
                versionControl.addVersion({
                    content: this.quill.getContents(),
                    type: 'user',
                    description: `导入文件: ${file.name}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                
                // 清除文件输入值，允许再次导入相同文件
                this.fileInput.value = '';
                
            } catch (error) {
                console.error('导入文件失败:', error);
                alert('导入文件失败，请重试');
            }
        }
        
        readFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                
                if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.html')) {
                    reader.readAsText(file);
                } else {
                    // 对于其他类型的文件，尝试以文本方式读取
                    reader.readAsText(file);
                }
            });
        }
        
        exportDocument() {
            // 保留原有的导出文档逻辑，以便将来需要时可以恢复
            try {
                // 创建格式选择对话框
                const formatDialog = document.createElement('div');
                formatDialog.className = 'format-dialog';
                formatDialog.innerHTML = `
                    <div class="format-dialog-content">
                        <h3>选择导出格式</h3>
                        <div class="format-options">
                            <button class="format-option" data-format="txt">
                                <i class="fas fa-file-alt"></i>
                                <span>纯文本文档</span>
                                <small>.txt</small>
                            </button>
                            <button class="format-option" data-format="html">
                                <i class="fas fa-file-code"></i>
                                <span>HTML 文档</span>
                                <small>.html</small>
                            </button>
                            <button class="format-option" data-format="md">
                                <i class="fa-solid fa-wave-square"></i>
                                <span>Markdown 文档</span>
                                <small>.md</small>
                            </button>
                        </div>
                        <button class="format-dialog-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                // 添加样式
                const style = document.createElement('style');
                style.textContent = `
                    .format-dialog {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    
                    .format-dialog-content {
                        background: white;
                        padding: 24px;
                        border-radius: 12px;
                        position: relative;
                        width: 400px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    }
                    
                    .format-dialog h3 {
                        margin: 0 0 16px 0;
                        color: #1E293B;
                        font-size: 18px;
                    }
                    
                    .format-options {
                        display: grid;
                        gap: 12px;
                    }
                    
                    .format-option {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px;
                        border: 1px solid #E2E8F0;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    }
                    
                    .format-option:hover {
                        background: #F8FAFC;
                        border-color: #CBD5E1;
                        transform: translateY(-1px);
                    }
                    
                    .format-option i {
                        font-size: 20px;
                        color: #64748B;
                    }
                    
                    .format-option span {
                        flex: 1;
                        font-size: 14px;
                        color: #334155;
                    }
                    
                    .format-option small {
                        color: #64748B;
                        font-size: 12px;
                    }
                    
                    .format-dialog-close {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        background: none;
                        border: none;
                        color: #64748B;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                    }
                    
                    .format-dialog-close:hover {
                        background: #F1F5F9;
                    }
                `;
                document.head.appendChild(style);
                
                // 添加对话框到页面
                document.body.appendChild(formatDialog);
                
                // 处理格式选择
                const handleFormatSelect = (format) => {
                    let content = '';
                    let type = 'text/plain';
                    let extension = format;
                    
                    switch (format) {
                        case 'html':
                            content = document.querySelector('.ql-editor').innerHTML;
                            type = 'text/html';
                            break;
                        case 'md':
                            content = this.quill.getText();
                            type = 'text/markdown';
                            break;
                        default:
                            content = this.quill.getText();
                            type = 'text/plain';
                    }
                    
                    // 创建 Blob
                    const blob = new Blob([content], { type: `${type};charset=utf-8` });
                    
                    // 创建下载链接
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `文档.${extension}`;
                    
                    // 触发下载
                    document.body.appendChild(link);
                    link.click();
                    
                    // 清理
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(link);
                    formatDialog.remove();
                };
                
                // 绑定事件
                formatDialog.querySelectorAll('.format-option').forEach(button => {
                    button.addEventListener('click', () => {
                        handleFormatSelect(button.dataset.format);
                    });
                });
                
                // 关闭对话框
                formatDialog.querySelector('.format-dialog-close').addEventListener('click', () => {
                    formatDialog.remove();
                });
                
                // 点击背景关闭
                formatDialog.addEventListener('click', (e) => {
                    if (e.target === formatDialog) {
                        formatDialog.remove();
                    }
                });
                
            } catch (error) {
                console.error('导出文件失败:', error);
                alert('导出文件失败，请重试');
            }
        }

        // 显示协同编辑对话框
        showCollaborationDialog() {
            try {
                // 创建协同编辑对话框
                const collaborationDialog = document.createElement('div');
                collaborationDialog.className = 'collaboration-dialog';
                collaborationDialog.innerHTML = `
                    <div class="collaboration-dialog-content">
                        <h3>协同编辑</h3>
                        <div class="collaboration-options">
                            <button class="collaboration-option" id="createSessionBtn">
                                <i class="fas fa-plus-circle"></i>
                                <span>创建协同会话</span>
                                <small>生成连接码供他人加入</small>
                            </button>
                            <button class="collaboration-option" id="joinSessionBtn">
                                <i class="fas fa-sign-in-alt"></i>
                                <span>加入协同会话</span>
                                <small>输入连接码</small>
                            </button>
                        </div>
                        <div class="connection-status-container" style="display: none;">
                            <div class="connection-status">未连接</div>
                        </div>
                        <div id="connectionCodeContainer" style="display: none;">
                            <h4>连接码</h4>
                            <div class="connection-code-display">
                                <span id="connectionCode"></span>
                                <button id="copyCodeBtn" title="复制连接码">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <p class="code-hint">将此连接码分享给您希望一起协作的人</p>
                        </div>
                        <div id="connectionInputContainer" style="display: none;">
                            <h4>输入连接码</h4>
                            <div class="connection-code-input">
                                <input type="text" id="connectionCodeInput" placeholder="输入连接码...">
                                <button id="connectBtn">
                                    <i class="fas fa-link"></i> 连接
                                </button>
                            </div>
                        </div>
                        <button class="collaboration-dialog-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                // 添加样式
                const style = document.createElement('style');
                style.textContent = `
                    .collaboration-dialog {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                    }
                    
                    .collaboration-dialog-content {
                        background: white;
                        padding: 24px;
                        border-radius: 12px;
                        position: relative;
                        width: 450px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    }
                    
                    .collaboration-dialog h3 {
                        margin: 0 0 16px 0;
                        color: #1E293B;
                        font-size: 18px;
                    }
                    
                    .collaboration-dialog h4 {
                        margin: 16px 0 8px 0;
                        color: #334155;
                        font-size: 16px;
                    }
                    
                    .collaboration-options {
                        display: grid;
                        gap: 12px;
                    }
                    
                    .collaboration-option {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 16px;
                        border: 1px solid #E2E8F0;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        width: 100%;
                        text-align: left;
                    }
                    
                    .collaboration-option:hover {
                        background: #F8FAFC;
                        border-color: #CBD5E1;
                        transform: translateY(-1px);
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                    }
                    
                    .collaboration-option i {
                        font-size: 20px;
                        color: #14B8A6;
                    }
                    
                    .collaboration-option span {
                        flex: 1;
                        font-size: 16px;
                        color: #334155;
                    }
                    
                    .collaboration-option small {
                        color: #64748B;
                        font-size: 12px;
                        display: block;
                        margin-top: 4px;
                    }
                    
                    .connection-status-container {
                        margin-top: 16px;
                        text-align: center;
                    }
                    
                    .connection-status {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 16px;
                        background: #F1F5F9;
                        color: #64748B;
                        font-size: 14px;
                    }
                    
                    .connection-status.connected {
                        background: #DCFCE7;
                        color: #166534;
                    }
                    
                    .connection-status.connecting {
                        background: #FEF3C7;
                        color: #92400E;
                    }
                    
                    .connection-code-display {
                        display: flex;
                        align-items: center;
                        padding: 12px 16px;
                        background: #F8FAFC;
                        border: 1px solid #E2E8F0;
                        border-radius: 8px;
                        margin: 8px 0;
                    }
                    
                    .connection-code-display span {
                        flex: 1;
                        font-family: monospace;
                        font-size: 18px;
                        color: #334155;
                        letter-spacing: 2px;
                    }
                    
                    .connection-code-display button {
                        background: none;
                        border: none;
                        color: #64748B;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 4px;
                    }
                    
                    .connection-code-display button:hover {
                        background: #E2E8F0;
                        color: #334155;
                    }
                    
                    .code-hint {
                        font-size: 13px;
                        color: #64748B;
                        margin: 8px 0 0 0;
                    }
                    
                    .connection-code-input {
                        display: flex;
                        gap: 8px;
                        margin: 8px 0;
                    }
                    
                    .connection-code-input input {
                        flex: 1;
                        padding: 10px 16px;
                        border: 1px solid #E2E8F0;
                        border-radius: 8px;
                        font-family: monospace;
                        font-size: 16px;
                        color: #334155;
                    }
                    
                    .connection-code-input input:focus {
                        outline: none;
                        border-color: #14B8A6;
                        box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
                    }
                    
                    .connection-code-input button {
                        padding: 10px 16px;
                        background: #14B8A6;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        white-space: nowrap;
                    }
                    
                    .connection-code-input button:hover {
                        background: #0D9488;
                    }
                    
                    .collaboration-dialog-close {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        background: none;
                        border: none;
                        color: #64748B;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                    }
                    
                    .collaboration-dialog-close:hover {
                        background: #F1F5F9;
                    }
                `;
                document.head.appendChild(style);
                
                // 添加对话框到页面
                document.body.appendChild(collaborationDialog);
                
                // 绑定事件
                const createSessionBtn = document.getElementById('createSessionBtn');
                const joinSessionBtn = document.getElementById('joinSessionBtn');
                const connectionCodeContainer = document.getElementById('connectionCodeContainer');
                const connectionInputContainer = document.getElementById('connectionInputContainer');
                const connectionCode = document.getElementById('connectionCode');
                const copyCodeBtn = document.getElementById('copyCodeBtn');
                const connectionCodeInput = document.getElementById('connectionCodeInput');
                const connectBtn = document.getElementById('connectBtn');
                const connectionStatusContainer = document.querySelector('.connection-status-container');
                const connectionStatus = document.querySelector('.connection-status');
                
                // 创建会话按钮点击事件
                createSessionBtn.addEventListener('click', () => {
                    // 隐藏选项，显示连接码容器
                    document.querySelector('.collaboration-options').style.display = 'none';
                    connectionCodeContainer.style.display = 'block';
                    connectionStatusContainer.style.display = 'block';
                    
                    // 初始化PeerJS连接 - 创建会话
                    this.initPeerConnection(true, connectionStatus);
                });
                
                // 加入会话按钮点击事件
                joinSessionBtn.addEventListener('click', () => {
                    // 隐藏选项，显示连接码输入容器
                    document.querySelector('.collaboration-options').style.display = 'none';
                    connectionInputContainer.style.display = 'block';
                    connectionStatusContainer.style.display = 'block';
                    
                    // 初始化PeerJS连接 - 加入会话
                    this.initPeerConnection(false, connectionStatus);
                });
                
                // 复制连接码按钮点击事件
                copyCodeBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(connectionCode.textContent)
                        .then(() => {
                            copyCodeBtn.innerHTML = '<i class="fas fa-check"></i>';
                            setTimeout(() => {
                                copyCodeBtn.innerHTML = '<i class="fas fa-copy"></i>';
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('无法复制连接码:', err);
                            alert('复制失败，请手动复制连接码');
                        });
                });
                
                // 连接按钮点击事件
                connectBtn.addEventListener('click', () => {
                    const code = connectionCodeInput.value.trim();
                    if (code) {
                        // 连接到主机
                        this.connectToPeer(code, connectionStatus);
                    } else {
                        alert('请输入有效的连接码');
                    }
                });
                
                // 关闭对话框
                const closeDialog = () => {
                    // 如果连接已建立，则保持连接状态
                    // 但关闭对话框
                    collaborationDialog.remove();
                };
                
                collaborationDialog.querySelector('.collaboration-dialog-close').addEventListener('click', closeDialog);
                
                // 点击背景关闭
                collaborationDialog.addEventListener('click', (e) => {
                    if (e.target === collaborationDialog) {
                        closeDialog();
                    }
                });
                
            } catch (error) {
                console.error('显示协同编辑对话框失败:', error);
                alert('无法启动协同编辑功能，请检查网络连接后重试');
            }
        }
        
        // 初始化PeerJS连接
        async initPeerConnection(asHost, statusElement) {
            try {
                // 检查PeerJS库是否已加载
                if (typeof Peer === 'undefined') {
                    // 动态加载PeerJS库
                    await this.loadPeerJS();
                }
                
                // 更新状态
                statusElement.textContent = '正在初始化连接...';
                statusElement.className = 'connection-status connecting';
                
                // 生成唯一ID - 使用更短、更友好的ID
                const uniqueId = 'doc-' + Math.floor(Math.random() * 9000 + 1000);
                
                // 创建Peer实例 - 使用完全点对点模式
                peer = new Peer(uniqueId, {
                    debug: 3,
                    // 不使用服务器，直接使用WebRTC点对点连接
                    config: {
                        'iceServers': [
                            // 使用Google和Twilio的公共STUN服务器获取网络信息
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ],
                        'iceTransportPolicy': 'all',
                        'sdpSemantics': 'unified-plan'
                    }
                });
                
                console.log('正在创建点对点连接:', uniqueId);
                
                // Peer打开时的回调
                peer.on('open', (id) => {
                    peerId = id;
                    isHost = asHost;
                    
                    console.log('点对点连接已就绪，ID:', id);
                    
                    if (asHost) {
                        // 显示连接码
                        const connectionCode = document.getElementById('connectionCode');
                        connectionCode.textContent = id;
                        
                        statusElement.textContent = '等待他人连接...';
                        statusElement.className = 'connection-status connecting';
                    } else {
                        statusElement.textContent = '连接已就绪，请输入连接码';
                        statusElement.className = 'connection-status connecting';
                    }
                });
                
                // 处理错误
                peer.on('error', (err) => {
                    console.error('WebRTC连接错误:', err.type, err);
                    
                    let errorMessage = '连接错误: ' + err.type;
                    
                    // 根据错误类型提供更详细的信息
                    switch(err.type) {
                        case 'peer-unavailable':
                            errorMessage = '无法连接到对方，连接码可能不正确';
                            break;
                        case 'network':
                            errorMessage = '网络连接问题，请检查网络设置';
                            break;
                        case 'webrtc':
                            errorMessage = 'WebRTC连接失败，两台设备可能不在同一网络';
                            break;
                        case 'browser-incompatible':
                            errorMessage = '浏览器不支持WebRTC';
                            break;
                    }
                    
                    statusElement.textContent = errorMessage;
                    statusElement.className = 'connection-status';
                    this.showNotification(errorMessage, 'error');
                });
                
                // 处理连接
                peer.on('connection', (conn) => {
                    console.log('收到点对点连接请求:', conn.peer);
                    this.handleConnection(conn, statusElement);
                });
                
                // 处理连接关闭
                peer.on('close', () => {
                    console.log('WebRTC连接已关闭');
                    this.handleDisconnect(statusElement);
                });
                
                // 处理连接断开
                peer.on('disconnected', () => {
                    console.log('WebRTC连接已断开，尝试直接点对点重连...');
                    
                    // 显示重连状态
                    statusElement.textContent = '连接断开，正在尝试重连...';
                    statusElement.className = 'connection-status connecting';
                    
                    // 尝试重新建立连接
                    setTimeout(() => {
                        if (!isConnected) {
                            // 如果3秒后仍未连接，尝试重新创建连接
                            peer.reconnect();
                        }
                    }, 3000);
                });
                
            } catch (error) {
                console.error('初始化WebRTC连接失败:', error);
                statusElement.textContent = '连接初始化失败';
                statusElement.className = 'connection-status';
            }
        }
        
        // 加载PeerJS库
        loadPeerJS() {
            return new Promise((resolve, reject) => {
                // 先检查是否已存在PeerJS脚本
                if (document.querySelector('script[src*="peerjs"]')) {
                    // 已存在，直接解析
                    console.log('PeerJS库已加载');
                    return resolve();
                }
                
                console.log('正在加载PeerJS库...');
                const script = document.createElement('script');
                
                // 使用稳定的CDN加载
                script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
                script.onload = () => {
                    console.log('PeerJS库加载成功');
                    resolve();
                };
                script.onerror = () => {
                    console.error('PeerJS库加载失败，尝试备用CDN');
                    
                    // 尝试备用CDN
                    const backupScript = document.createElement('script');
                    backupScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.4.7/peerjs.min.js';
                    backupScript.onload = resolve;
                    backupScript.onerror = reject;
                    document.head.appendChild(backupScript);
                };
                document.head.appendChild(script);
            });
        }
        
        // 连接到对方Peer
        connectToPeer(peerId, statusElement) {
            try {
                statusElement.textContent = '正在建立点对点连接...';
                statusElement.className = 'connection-status connecting';
                
                console.log('尝试连接到对方:', peerId);
                
                // 创建直接点对点连接
                const conn = peer.connect(peerId, {
                    reliable: true,
                    serialization: 'json',
                    // 最大重试次数
                    retries: 5,
                    // 元数据
                    metadata: {
                        clientName: 'Smitty协同编辑客户端',
                        timestamp: Date.now()
                    }
                });
                
                // 设置连接超时
                const connectionTimeout = setTimeout(() => {
                    if (!isConnected) {
                        statusElement.textContent = '连接超时，对方可能不在线';
                        statusElement.className = 'connection-status';
                        this.showNotification('点对点连接超时，请检查连接码并确保两台设备在同一网络', 'error');
                    }
                }, 15000); // 15秒超时
                
                // 连接处理
                this.handleConnection(conn, statusElement, connectionTimeout);
                
            } catch (error) {
                console.error('连接失败:', error);
                statusElement.textContent = '点对点连接失败';
                statusElement.className = 'connection-status';
                this.showNotification('点对点连接失败: ' + error.message, 'error');
            }
        }
        
        // 设置编辑器同步
        setupEditorSync() {
            console.log('设置实时同步系统 - 直接内容传输模式');
            
            // 清除之前的所有同步定时器
            if (this.realTimeSyncInterval) clearInterval(this.realTimeSyncInterval);
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            if (this.periodicSyncInterval) clearInterval(this.periodicSyncInterval);
            
            // 取消之前的监听器，避免重复绑定
            if (this.textChangeHandler) {
                this.quill.off('text-change', this.textChangeHandler);
            }
            
            // 生成唯一的编辑会话ID
            this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            console.log('创建新的编辑会话:', this.sessionId);
            
            // 记录上次文档内容的哈希值，用于检测变化
            this.lastContentHash = '';
            
            // 创建内容变化标志
            this.contentChanged = false;
            
            // 定义文本变化处理函数
            this.textChangeHandler = (delta, oldContents, source) => {
                if (source === 'user') {
                    // 标记内容已变化，等待下一次同步周期发送
                    this.contentChanged = true;
                }
            };
            
            // 注册文本变化监听器
            this.quill.on('text-change', this.textChangeHandler);
            
            // 设置高频率的同步周期 (300ms)
            this.realTimeSyncInterval = setInterval(() => {
                if (isConnected && connections.length > 0 && this.contentChanged) {
                    this.sendCurrentContent();
                    this.contentChanged = false;
                }
            }, 300);
            
            // 设置心跳机制 (2秒)
            this.heartbeatInterval = setInterval(() => {
                if (isConnected && connections.length > 0) {
                    this.sendHeartbeat();
                }
            }, 2000);
            
            // 设置强制同步周期 (5秒发送一次完整内容，不管是否有变化)
            this.periodicSyncInterval = setInterval(() => {
                if (isConnected && connections.length > 0) {
                    this.sendCurrentContent(true);
                }
            }, 5000);
            
            console.log('实时同步系统已设置完成');
        }

        // 发送当前编辑器内容
        sendCurrentContent(isForced = false) {
            if (!isConnected || connections.length === 0) return;
            
            try {
                // 获取当前编辑器内容
                const contentHtml = this.quill.root.innerHTML;
                const contentText = this.quill.getText();
                
                // 简单的内容哈希计算
                const currentHash = this.simpleHash(contentHtml);
                
                // 如果内容没有变化且不是强制发送，则跳过
                if (currentHash === this.lastContentHash && !isForced) {
                    return;
                }
                
                // 更新内容哈希
                this.lastContentHash = currentHash;
                
                // 准备数据包
                const contentPackage = {
                    type: 'content_update',
                    contentHtml: contentHtml,
                    contentText: contentText,
                    sessionId: this.sessionId,
                    timestamp: Date.now(),
                    title: documentTitleInput ? documentTitleInput.value : '',
                    selection: this.quill.getSelection()
                };
                
                // 发送给所有连接的peer
                let sentCount = 0;
                connections.forEach(conn => {
                    if (conn.open) {
                        try {
                            conn.send(contentPackage);
                            sentCount++;
                        } catch (error) {
                            console.error('发送内容更新失败:', error);
                        }
                    }
                });
                
                if (sentCount > 0) {
                    console.log(`已向${sentCount}个连接发送内容更新, 时间戳:${contentPackage.timestamp}, 哈希:${currentHash}`);
                }
            } catch (error) {
                console.error('准备发送内容时出错:', error);
            }
        }

        // 简单的哈希函数，用于检测内容变化
        simpleHash(str) {
            let hash = 0;
            if (str.length === 0) return hash;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return hash.toString();
        }

        // 发送心跳
        sendHeartbeat() {
            if (!isConnected || connections.length === 0) return;
            
            const heartbeat = {
                type: 'heartbeat',
                timestamp: Date.now(),
                sessionId: this.sessionId
            };
            
            connections.forEach(conn => {
                if (conn.open) {
                    try {
                        conn.send(heartbeat);
                    } catch (error) {
                        console.error('发送心跳失败:', error);
                        this.removeConnection(conn);
                    }
                } else {
                    this.removeConnection(conn);
                }
            });
        }

        // 处理接收到的数据
        handleReceivedData(data) {
            try {
                // 排除自己发送的消息
                if (data.sessionId === this.sessionId) {
                    return;
                }
                
                console.log('收到消息类型:', data.type);
                
                switch (data.type) {
                    case 'content_update':
                        this.applyReceivedContent(data);
                        break;
                        
                    case 'heartbeat':
                        // 收到心跳，回应一个心跳确认
                        if (data.sessionId !== this.sessionId) {
                            connections.forEach(conn => {
                                if (conn.open) {
                                    try {
                                        conn.send({
                                            type: 'heartbeat_ack',
                                            timestamp: Date.now(),
                                            responseToTimestamp: data.timestamp,
                                            sessionId: this.sessionId
                                        });
                                    } catch (e) {
                                        console.error('回应心跳失败:', e);
                                    }
                                }
                            });
                        }
                        break;
                        
                    case 'heartbeat_ack':
                        // 收到心跳确认，更新连接状态
                        console.log('收到心跳确认，往返延迟:', Date.now() - data.responseToTimestamp, 'ms');
                        break;
                        
                    case 'request_content':
                        // 收到内容请求，发送当前内容
                        this.sendCurrentContent(true);
                        break;
                        
                    default:
                        console.warn('未知消息类型:', data.type);
                }
            } catch (error) {
                console.error('处理接收数据时出错:', error);
                // 请求重新发送内容
                this.requestContent();
            }
        }

        // 应用接收到的内容
        applyReceivedContent(data) {
            try {
                console.log('应用收到的内容更新, 时间戳:', data.timestamp);
                
                // 暂时禁用本地变化监听，防止循环更新
                this.quill.off('text-change', this.textChangeHandler);
                
                // 保存当前的滚动位置
                const scrollTop = this.quill.scrollingContainer.scrollTop;
                
                // 应用HTML内容
                window.isApplyingAIResponse = true; // 防止触发选择状态清除
                this.quill.clipboard.dangerouslyPasteHTML(data.contentHtml);
                window.isApplyingAIResponse = false;
                
                // 恢复滚动位置
                this.quill.scrollingContainer.scrollTop = scrollTop;
                
                // 如果有标题，也更新标题
                if (data.title && documentTitleInput && data.title !== documentTitleInput.value) {
                    documentTitleInput.value = data.title;
                    document.title = data.title + ' - Smitty AI 编辑器';
                    localStorage.setItem('document-title', data.title);
                }
                
                // 显示远程用户的光标位置
                if (data.selection) {
                    this.showRemoteCursor(data.selection);
                }
                
                // 恢复本地变化监听
                setTimeout(() => {
                    this.quill.on('text-change', this.textChangeHandler);
                }, 100);
                
                // 更新最后内容哈希
                this.lastContentHash = this.simpleHash(data.contentHtml);
                
                console.log('内容更新应用成功');
                this.updateCollaborationStatus('connected', '已同步最新内容');
            } catch (error) {
                console.error('应用收到的内容时出错:', error);
                // 重新请求内容
                this.requestContent();
            }
        }

        // 请求完整内容
        requestContent() {
            if (!isConnected || connections.length === 0) return;
            
            connections.forEach(conn => {
                if (conn.open) {
                    try {
                        conn.send({
                            type: 'request_content',
                            timestamp: Date.now(),
                            sessionId: this.sessionId
                        });
                        console.log('已请求完整内容');
                    } catch (error) {
                        console.error('请求内容失败:', error);
                    }
                }
            });
        }

        // 显示远程光标
        showRemoteCursor(position) {
            if (!position) return;
            
            // 如果没有远程光标容器，创建一个
            if (!this.remoteCursorContainer) {
                this.remoteCursorContainer = document.createElement('div');
                this.remoteCursorContainer.className = 'remote-cursor';
                this.remoteCursorContainer.style.position = 'absolute';
                this.remoteCursorContainer.style.width = '2px';
                this.remoteCursorContainer.style.height = '20px';
                this.remoteCursorContainer.style.backgroundColor = '#FF5722';
                this.remoteCursorContainer.style.zIndex = '9999';
                this.remoteCursorContainer.style.pointerEvents = 'none';
                this.remoteCursorContainer.style.animation = 'cursorBlink 1.2s infinite';
                
                // 添加用户标识
                const userLabel = document.createElement('div');
                userLabel.className = 'remote-user-label';
                userLabel.style.position = 'absolute';
                userLabel.style.top = '-18px';
                userLabel.style.left = '0px';
                userLabel.style.backgroundColor = '#FF5722';
                userLabel.style.color = 'white';
                userLabel.style.padding = '2px 4px';
                userLabel.style.borderRadius = '3px';
                userLabel.style.fontSize = '10px';
                userLabel.style.fontWeight = 'bold';
                userLabel.style.whiteSpace = 'nowrap';
                userLabel.textContent = '协作者';
                
                this.remoteCursorContainer.appendChild(userLabel);
                this.quill.container.appendChild(this.remoteCursorContainer);
                
                // 添加光标闪烁动画
                if (!document.getElementById('remote-cursor-style')) {
                    const style = document.createElement('style');
                    style.id = 'remote-cursor-style';
                    style.textContent = `
                        @keyframes cursorBlink {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            // 获取选择位置的坐标
            try {
                const bounds = this.quill.getBounds(position.index);
                
                if (bounds) {
                    // 显示远程光标
                    this.remoteCursorContainer.style.display = 'block';
                    this.remoteCursorContainer.style.left = `${bounds.left}px`;
                    this.remoteCursorContainer.style.top = `${bounds.top}px`;
                    this.remoteCursorContainer.style.height = `${bounds.height}px`;
                    
                    // 5秒后隐藏光标
                    clearTimeout(this.remoteCursorTimeout);
                    this.remoteCursorTimeout = setTimeout(() => {
                        this.remoteCursorContainer.style.display = 'none';
                    }, 5000);
                }
            } catch (error) {
                console.error('显示远程光标失败:', error);
            }
        }

        // 断开与特定连接
        removeConnection(conn) {
            const index = connections.indexOf(conn);
            if (index > -1) {
                connections.splice(index, 1);
                console.log('已移除断开的连接');
                
                // 更新协同状态指示器
                if (connections.length === 0) {
                    isConnected = false;
                    this.updateCollaborationStatus('disconnected', '连接已断开');
                } else {
                    this.updateCollaborationStatus('connected', `已连接 (${connections.length})`);
                }
            }
        }

        // 发送完整内容（初始化时使用）
        sendFullContent() {
            this.sendCurrentContent(true);
        }

        // 设置编辑器同步
        setupEditorSync() {
            // 监听编辑器变化 - 改进为更高频率的同步机制
            this.quill.on('text-change', (delta, oldContents, source) => {
                // 只有用户操作才发送更新，避免循环更新
                if (source === 'user' && isConnected) {
                    const now = Date.now();
                    
                    // 减少节流时间，提高同步频率
                    if (now - lastUpdateTime > 100) { // 从500ms降低到100ms
                        lastUpdateTime = now;
                        
                        // 发送Delta变更
                        const updateData = {
                            type: 'update',
                            delta: delta,
                            source: 'remote',
                            timestamp: now // 添加时间戳用于处理冲突
                        };
                        
                        // 发送给所有连接
                        connections.forEach(conn => {
                            if (conn.open) {
                                try {
                                    conn.send(updateData);
                                } catch (error) {
                                    console.error('发送更新失败:', error);
                                    this.showNotification('内容同步失败，请检查连接', 'error');
                                }
                            }
                        });
                    }
                }
            });
            
            // 如果有标题输入框，也同步标题
            if (documentTitleInput) {
                documentTitleInput.addEventListener('input', this.debounce(() => {
                    if (isConnected) {
                        const titleData = {
                            type: 'title',
                            title: documentTitleInput.value,
                            timestamp: Date.now()
                        };
                        
                        // 发送给所有连接
                        connections.forEach(conn => {
                            if (conn.open) {
                                try {
                                    conn.send(titleData);
                                } catch (error) {
                                    console.error('发送标题更新失败:', error);
                                }
                            }
                        });
                    }
                }, 200)); // 从300ms降低到200ms
            }
            
            // 显示协同编辑状态指示器
            this.showCollaborationIndicator();
            
            // 添加心跳机制，确保连接保持活跃
            this.startHeartbeat();
        }
        
        // 启动心跳机制以保持连接活跃
        startHeartbeat() {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            
            // 缩短心跳间隔到2秒，使连接状态更稳定
            this.heartbeatInterval = setInterval(() => {
                if (isConnected && connections.length > 0) {
                    const heartbeatData = {
                        type: 'heartbeat',
                        timestamp: Date.now(),
                        documentLength: this.quill.getLength(),
                        version: this.currentDocVersion
                    };
                    
                    connections.forEach(conn => {
                        if (conn.open) {
                            try {
                                conn.send(heartbeatData);
                            } catch (error) {
                                console.error('发送心跳失败:', error);
                                // 尝试检查连接
                                this.checkConnection(conn);
                            }
                        } else {
                            // 如果连接已关闭，移除连接
                            this.removeConnection(conn);
                        }
                    });
                    
                    // 检查连接状态
                    this.checkConnectionStatus();
                }
            }, 2000); // 2秒一次心跳
        }
        
        // 检查连接状态
        checkConnectionStatus() {
            // 过滤掉已关闭的连接
            connections = connections.filter(conn => conn.open);
            
            // 更新协同编辑指示器
            const indicator = document.querySelector('.collaboration-indicator');
            if (indicator) {
                const userCount = connections.length + 1; // 包括自己
                const userCountSpan = indicator.querySelector('.user-count');
                if (userCountSpan) {
                    userCountSpan.textContent = userCount;
                }
            }
            
            // 如果没有连接，更新状态
            if (connections.length === 0) {
                isConnected = false;
                this.updateCollaborationStatus('disconnected');
            }
        }
        
        // 更新协同编辑状态
        updateCollaborationStatus(status, message = '') {
            const indicator = document.querySelector('.collaboration-indicator');
            if (indicator) {
                if (status === 'connected') {
                    indicator.classList.add('active');
                    indicator.classList.remove('error');
                } else if (status === 'error') {
                    indicator.classList.add('error');
                    indicator.classList.remove('active');
                } else {
                    indicator.classList.remove('active', 'error');
                }
                
                if (message) {
                    const statusText = indicator.querySelector('.status-text');
                    if (statusText) {
                        statusText.textContent = message;
                    }
                }
            }
        }
        
        // 移除连接
        removeConnection(conn) {
            const index = connections.indexOf(conn);
            if (index !== -1) {
                connections.splice(index, 1);
            }
        }
        
        // 处理断开连接
        handleDisconnect(statusElement) {
            console.log('已断开连接');
            isConnected = false;
            connections = [];
            
            if (statusElement) {
                statusElement.textContent = '已断开连接';
                statusElement.className = 'connection-status';
            }
            
            // 显示提示
            this.showNotification('协同编辑会话已断开');
        }
        
        // 显示协同编辑状态指示器 - 增强版
        showCollaborationIndicator() {
            // 检查是否已存在指示器
            if (document.querySelector('.collaboration-indicator')) {
                return;
            }
            
            const indicator = document.createElement('div');
            indicator.className = 'collaboration-indicator';
            indicator.innerHTML = `
                <i class="fas fa-users"></i>
                <span class="status-text">协同编辑中</span>
                <span class="user-count">${connections.length + 1}</span>
            `;
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .collaboration-indicator {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 8px 12px;
                    background: #14B8A6;
                    color: white;
                    border-radius: 20px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    z-index: 100;
                    transition: all 0.3s ease;
                }
                
                .collaboration-indicator i {
                    font-size: 12px;
                }
                
                .collaboration-indicator .user-count {
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                    min-width: 18px;
                    height: 18px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 10px;
                    font-size: 11px;
                    margin-left: 4px;
                    padding: 0 4px;
                }
                
                .collaboration-indicator.active {
                    background: #10B981;
                }
                
                .collaboration-indicator.error {
                    background: #EF4444;
                }
                
                /* 添加闪烁效果 */
                @keyframes indicator-pulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }
                
                .collaboration-indicator.active .user-count {
                    animation: indicator-pulse 2s infinite;
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(indicator);
            
            // 添加点击功能 - 显示连接信息
            indicator.addEventListener('click', () => {
                this.showConnectionDetails();
            });
        }
        
        // 显示连接详情
        showConnectionDetails() {
            // 如果已有详情窗口，则不重复创建
            if (document.querySelector('.connection-details')) {
                return;
            }
            
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'connection-details';
            
            let connectionInfo = '';
            if (isConnected && connections.length > 0) {
                connectionInfo = `<p>当前连接: ${connections.length}个</p>`;
                if (isHost) {
                    connectionInfo += `<p>您是主机</p>`;
                } else {
                    connectionInfo += `<p>您是客户端</p>`;
                }
                
                // 添加重新同步按钮
                connectionInfo += `
                    <button id="resyncBtn" class="resync-btn">
                        <i class="fas fa-sync-alt"></i> 重新同步
                    </button>
                `;
            } else {
                connectionInfo = `<p>未连接</p>`;
            }
            
            detailsContainer.innerHTML = `
                <div class="details-content">
                    <h3>协同编辑状态</h3>
                    ${connectionInfo}
                    <button class="close-details">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            // 添加样式
            const style = document.createElement('style');
            style.textContent = `
                .connection-details {
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 101;
                    padding: 16px;
                    font-size: 14px;
                    min-width: 200px;
                }
                
                .details-content h3 {
                    margin: 0 0 12px 0;
                    font-size: 16px;
                    color: #334155;
                }
                
                .details-content p {
                    margin: 8px 0;
                    color: #64748B;
                }
                
                .close-details {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #94A3B8;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }
                
                .close-details:hover {
                    background: #F1F5F9;
                    color: #64748B;
                }
                
                .resync-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 12px;
                    padding: 6px 12px;
                    background: #14B8A6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }
                
                .resync-btn:hover {
                    background: #0D9488;
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(detailsContainer);
            
            // 关闭按钮
            detailsContainer.querySelector('.close-details').addEventListener('click', () => {
                detailsContainer.remove();
            });
            
            // 重新同步按钮
            const resyncBtn = detailsContainer.querySelector('#resyncBtn');
            if (resyncBtn) {
                resyncBtn.addEventListener('click', () => {
                    if (isHost) {
                        this.sendFullContent();
                        this.showNotification('已重新发送文档内容');
                    } else {
                        this.requestFullContent();
                        this.showNotification('已请求最新文档内容');
                    }
                    detailsContainer.remove();
                });
            }
            
            // 点击外部区域关闭
            document.addEventListener('click', function closeDetails(e) {
                if (!detailsContainer.contains(e.target) && 
                    !document.querySelector('.collaboration-indicator').contains(e.target)) {
                    detailsContainer.remove();
                    document.removeEventListener('click', closeDetails);
                }
            });
        }
        
        // 显示通知 - 增强版支持不同类型
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `collaboration-notification ${type}`;
            
            // 根据类型选择图标
            let icon = 'info-circle';
            if (type === 'success') icon = 'check-circle';
            if (type === 'error') icon = 'exclamation-circle';
            if (type === 'warning') icon = 'exclamation-triangle';
            
            notification.innerHTML = `
                <i class="fas fa-${icon}"></i>
                <span>${message}</span>
            `;
            
            // 添加样式
            if (!document.getElementById('notification-styles')) {
                const style = document.createElement('style');
                style.id = 'notification-styles';
                style.textContent = `
                    .collaboration-notification {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        padding: 12px 16px;
                        background: #334155;
                        color: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        z-index: 1000;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        opacity: 0;
                        transform: translateY(10px);
                        animation: notification-show 0.3s forwards, notification-hide 0.3s 3s forwards;
                        max-width: 300px;
                    }
                    
                    .collaboration-notification i {
                        font-size: 16px;
                    }
                    
                    .collaboration-notification.success {
                        background: #10B981;
                    }
                    
                    .collaboration-notification.error {
                        background: #EF4444;
                    }
                    
                    .collaboration-notification.warning {
                        background: #F59E0B;
                    }
                    
                    @keyframes notification-show {
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    
                    @keyframes notification-hide {
                        to {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(notification);
            
            // 3.5秒后移除
            setTimeout(() => {
                notification.remove();
            }, 3500);
        }

        // 添加处理连接的函数
        handleConnection(conn, statusElement, connectionTimeout) {
            console.log('正在处理连接...');
            
            // 保存连接
            connections.push(conn);
            
            // 连接打开时
            conn.on('open', () => {
                console.log('连接已打开');
                isConnected = true;
                
                // 清除连接超时
                if (connectionTimeout) {
                    clearTimeout(connectionTimeout);
                }
                
                if (statusElement) {
                    statusElement.textContent = '已连接';
                    statusElement.className = 'connection-status connected';
                }
                
                // 如果是主机，发送当前文档内容给新连接的客户端
                if (isHost) {
                    console.log('作为主机发送文档内容...');
                    this.sendFullContent();
                } else {
                    // 如果是客户端，请求完整内容
                    console.log('作为客户端请求文档内容...');
                    this.requestFullContent();
                }
                
                // 设置编辑器变更监听
                this.setupEditorSync();
                
                // 显示成功通知
                this.showNotification('协同编辑已连接，可以开始共同编辑文档', 'success');
                this.updateCollaborationStatus('connected', '协同编辑已连接');
                
                // 找到当前的协同编辑对话框，并在2秒后自动关闭
                const collaborationDialog = document.querySelector('.collaboration-dialog');
                if (collaborationDialog) {
                    // 显示"连接成功，2秒后自动关闭"提示
                    const statusContainer = collaborationDialog.querySelector('.connection-status-container');
                    if (statusContainer) {
                        // 添加自动关闭提示
                        const autoCloseHint = document.createElement('div');
                        autoCloseHint.className = 'auto-close-hint';
                        autoCloseHint.textContent = '连接成功，窗口将在2秒后自动关闭';
                        autoCloseHint.style.color = '#10B981';
                        autoCloseHint.style.fontSize = '13px';
                        autoCloseHint.style.marginTop = '8px';
                        statusContainer.appendChild(autoCloseHint);
                    }
                    
                    // 2秒后自动关闭对话框
                    setTimeout(() => {
                        collaborationDialog.remove();
                    }, 2000);
                }
            });
            
            // 接收数据
            conn.on('data', (data) => {
                console.log('收到数据:', data.type);
                this.handleReceivedData(data);
            });
            
            // 处理连接关闭
            conn.on('close', () => {
                console.log('连接已关闭');
                this.removeConnection(conn);
                
                // 更新状态显示
                if (connections.length === 0) {
                    isConnected = false;
                    if (statusElement) {
                        statusElement.textContent = '连接已断开';
                        statusElement.className = 'connection-status';
                    }
                    this.updateCollaborationStatus('disconnected', '连接已断开');
                } else {
                    if (statusElement) {
                        statusElement.textContent = `已连接 (${connections.length})`;
                    }
                }
                
                this.showNotification('协同编辑连接已断开', 'warning');
            });
            
            // 处理错误
            conn.on('error', (err) => {
                console.error('连接错误:', err);
                if (statusElement) {
                    statusElement.textContent = '连接错误';
                    statusElement.className = 'connection-status';
                }
                this.showNotification('协同编辑连接错误', 'error');
                this.updateCollaborationStatus('error', '连接错误');
            });
        }

        // 添加方法以显示远程光标（可选功能）
        showRemoteCursor(position) {
            // 如果没有光标容器，创建一个
            if (!this.remoteCursorContainer) {
                this.remoteCursorContainer = document.createElement('div');
                this.remoteCursorContainer.className = 'remote-cursor';
                this.remoteCursorContainer.style.position = 'absolute';
                this.remoteCursorContainer.style.width = '2px';
                this.remoteCursorContainer.style.height = '20px';
                this.remoteCursorContainer.style.backgroundColor = '#FF5722';
                this.remoteCursorContainer.style.transition = 'all 0.1s ease';
                this.remoteCursorContainer.style.zIndex = '10';
                this.remoteCursorContainer.style.pointerEvents = 'none';
                this.quill.container.appendChild(this.remoteCursorContainer);
            }
            
            // 获取指定位置的坐标
            try {
                const bounds = this.quill.getBounds(position.index);
                if (bounds) {
                    this.remoteCursorContainer.style.display = 'block';
                    this.remoteCursorContainer.style.left = `${bounds.left}px`;
                    this.remoteCursorContainer.style.top = `${bounds.top}px`;
                    this.remoteCursorContainer.style.height = `${bounds.height}px`;
                    
                    // 闪烁效果
                    this.remoteCursorContainer.style.animation = 'remoteCursorBlink 1s infinite';
                    
                    // 3秒后隐藏光标
                    clearTimeout(this.remoteCursorTimeout);
                    this.remoteCursorTimeout = setTimeout(() => {
                        this.remoteCursorContainer.style.display = 'none';
                    }, 3000);
                }
            } catch (e) {
                console.error('显示远程光标失败:', e);
            }
        }

        // 开始定期完整同步
        startPeriodicSync() {
            if (this.periodicSyncInterval) {
                clearInterval(this.periodicSyncInterval);
            }
            
            // 每10秒进行一次完整同步
            this.periodicSyncInterval = setInterval(() => {
                if (isConnected && connections.length > 0) {
                    if (isHost) {
                        // 主机定期发送完整内容
                        console.log('执行定期完整同步...');
                        this.sendFullContent();
                    }
                }
            }, 10000); // 10秒
        }

        // 检查连接
        checkConnection(conn) {
            // 如果连接已关闭但未被移除
            if (!conn.open) {
                this.removeConnection(conn);
                return false;
            }
            
            try {
                // 尝试发送一个ping
                conn.send({
                    type: 'ping',
                    timestamp: Date.now()
                });
                return true;
            } catch (e) {
                console.error('连接检查失败:', e);
                this.removeConnection(conn);
                return false;
            }
        }
    }

    // 初始化版本控制和文档编辑器
    const versionControl = new VersionControl(quill);
    const documentEditor = new DocumentEditor(quill);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .selection-highlight {
            position: absolute;
            background-color: rgba(20, 184, 166, 0.1);
            pointer-events: none;
            z-index: 1;
            border-radius: 3px;
            overflow: visible;
        }
        
        .magic-highlight {
            animation: glow 3s infinite alternate;
            box-shadow: 0 0 8px rgba(20, 184, 166, 0.3);
        }
        
        /* 流动背景效果 */
        .flow-background {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, 
                rgba(20, 184, 166, 0), 
                rgba(20, 184, 166, 0.1), 
                rgba(56, 189, 248, 0.2), 
                rgba(20, 184, 166, 0.1), 
                rgba(20, 184, 166, 0));
            background-size: 400% 100%;
            animation: flowBackground 8s linear infinite;
        }
        
        /* 流动线条效果 */
        .flow-line {
            position: absolute;
            width: 150%;
            height: 1px;
            background: linear-gradient(90deg, 
                rgba(20, 184, 166, 0), 
                rgba(56, 189, 248, 0.5), 
                rgba(20, 184, 166, 0));
            top: 30%;
            left: -25%;
            animation: flowLine 4s linear infinite;
            opacity: 0.7;
            transform: translateY(-50%) rotate(-5deg);
        }
        
        .flow-line:nth-child(2) {
            top: 45%;
            animation-duration: 5s;
            opacity: 0.6;
            transform: translateY(-50%) rotate(2deg);
        }
        
        .flow-line:nth-child(3) {
            top: 60%;
            animation-duration: 3.5s;
            opacity: 0.8;
            transform: translateY(-50%) rotate(-10deg);
        }
        
        .flow-line:nth-child(4) {
            top: 75%;
            width: 200%;
            left: -50%;
            animation-duration: 6s;
            opacity: 0.4;
            transform: translateY(-50%) rotate(8deg);
        }
        
        .flow-line:nth-child(5) {
            top: 20%;
            width: 180%;
            left: -40%;
            animation-duration: 4.5s;
            opacity: 0.5;
            transform: translateY(-50%) rotate(-8deg);
        }
        
        /* 内部脉冲效果 */
        .inner-pulse {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(20, 184, 166, 0.1);
            animation: innerPulse 0.8s ease-in-out infinite;
            z-index: 2;
        }
        
        /* 内边框脉冲效果 */
        .pulse-border {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 3px solid rgba(20, 184, 166, 0.8);
            border-radius: 3px;
            animation: pulse 0.8s ease-in-out infinite;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.7);
            z-index: 3;
        }
        
        /* 多层脉冲光环 */
        .pulse-halo-1 {
            position: absolute;
            top: -6px;
            left: -6px;
            right: -6px;
            bottom: -6px;
            border: 3px solid rgba(20, 184, 166, 0.7);
            border-radius: 6px;
            animation: pulseHalo1 0.8s ease-in-out infinite;
            box-shadow: 0 0 18px rgba(56, 189, 248, 0.6);
            z-index: 1;
        }
        
        .pulse-halo-2 {
            position: absolute;
            top: -12px;
            left: -12px;
            right: -12px;
            bottom: -12px;
            border: 3px solid rgba(56, 189, 248, 0.6);
            border-radius: 10px;
            animation: pulseHalo2 0.8s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(20, 184, 166, 0.5);
            z-index: 0;
        }
        
        .pulse-halo-3 {
            position: absolute;
            top: -18px;
            left: -18px;
            right: -18px;
            bottom: -18px;
            border: 3px solid rgba(20, 184, 166, 0.5);
            border-radius: 14px;
            animation: pulseHalo3 0.8s ease-in-out infinite;
            box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
            z-index: -1;
        }
        
        .pulse-halo-4 {
            position: absolute;
            top: -24px;
            left: -24px;
            right: -24px;
            bottom: -24px;
            border: 3px solid rgba(56, 189, 248, 0.4);
            border-radius: 18px;
            animation: pulseHalo4 0.8s ease-in-out infinite;
            box-shadow: 0 0 30px rgba(20, 184, 166, 0.3);
            z-index: -2;
        }
        
        @keyframes flowBackground {
            0% {
                background-position: 0% 50%;
            }
            100% {
                background-position: 400% 50%;
            }
        }
        
        @keyframes flowLine {
            0% {
                transform: translateX(-100%) translateY(-50%) rotate(-5deg);
            }
            100% {
                transform: translateX(100%) translateY(-50%) rotate(-5deg);
            }
        }
        
        @keyframes glow {
            0% {
                background-color: rgba(20, 184, 166, 0.1);
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.2);
            }
            50% {
                background-color: rgba(20, 184, 166, 0.2);
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
            }
            100% {
                background-color: rgba(20, 184, 166, 0.15);
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.2);
            }
        }
        
        @keyframes innerPulse {
            0%, 100% {
                opacity: 0.2;
                background: rgba(20, 184, 166, 0.1);
            }
            50% {
                opacity: 0.6;
                background: rgba(20, 184, 166, 0.25);
            }
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 0.8;
                transform: scale(1);
                box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
            }
            50% {
                opacity: 1;
                transform: scale(1.05);
                box-shadow: 0 0 20px rgba(56, 189, 248, 0.9);
            }
        }
        
        @keyframes pulseHalo1 {
            0%, 100% {
                opacity: 0.6;
                transform: scale(1);
                box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
            }
            50% {
                opacity: 0.9;
                transform: scale(1.08);
                box-shadow: 0 0 24px rgba(56, 189, 248, 0.8);
            }
        }
        
        @keyframes pulseHalo2 {
            0%, 100% {
                opacity: 0.5;
                transform: scale(1);
                box-shadow: 0 0 15px rgba(20, 184, 166, 0.4);
            }
            50% {
                opacity: 0.8;
                transform: scale(1.1);
                box-shadow: 0 0 25px rgba(20, 184, 166, 0.7);
            }
        }
        
        @keyframes pulseHalo3 {
            0%, 100% {
                opacity: 0.4;
                transform: scale(1);
                box-shadow: 0 0 18px rgba(56, 189, 248, 0.3);
            }
            50% {
                opacity: 0.7;
                transform: scale(1.12);
                box-shadow: 0 0 28px rgba(56, 189, 248, 0.6);
            }
        }
        
        @keyframes pulseHalo4 {
            0%, 100% {
                opacity: 0.3;
                transform: scale(1);
                box-shadow: 0 0 20px rgba(20, 184, 166, 0.2);
            }
            50% {
                opacity: 0.6;
                transform: scale(1.15);
                box-shadow: 0 0 30px rgba(20, 184, 166, 0.5);
            }
        }
    `;
    document.head.appendChild(style);

    // 初始化用户名称显示和编辑功能
    function initUsernameFunctions() {
        // 查找头像容器
        const avatarContainer = document.querySelector('.flex.-space-x-2');
        
        // 如果未找到头像容器，则退出
        if (!avatarContainer) return;
        
        // 从本地存储获取用户名，如果不存在则使用默认值
        const savedUsername = localStorage.getItem('username') || '点击修改用户名';
        
        // 创建用户名显示容器
        const usernameDisplay = document.createElement('div');
        usernameDisplay.className = 'username-display';
        usernameDisplay.innerHTML = `
            <div class="username-badge">
                <i class="fas fa-user"></i>
                <span class="username-text">${savedUsername}</span>
            </div>
        `;
        
        // 替换头像容器为用户名显示
        avatarContainer.parentNode.replaceChild(usernameDisplay, avatarContainer);
        
        // 为用户名显示添加点击事件 - 打开编辑模态框
        usernameDisplay.addEventListener('click', function() {
            openUsernameEditorModal(savedUsername);
        });
    }

    /**
     * 打开用户名编辑模态框
     * @param {string} currentUsername 当前用户名
     */
    function openUsernameEditorModal(currentUsername) {
        // 检查是否已存在模态框，如果存在则不重复创建
        if (document.querySelector('.username-editor-modal')) return;
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'username-editor-modal';
        modal.innerHTML = `
            <div class="username-editor-content">
                <div class="username-editor-header">
                    <h3>修改用户名</h3>
                    <button class="username-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="username-editor-body">
                    <label for="username-input">请输入您的用户名</label>
                    <input type="text" id="username-input" class="username-input" 
                           value="${currentUsername}" placeholder="请输入用户名" maxlength="20">
                    <p class="username-hint">用户名最长为20个字符</p>
                    <div class="username-error" style="display: none;"></div>
                </div>
                <div class="username-editor-footer">
                    <button class="username-cancel-btn">取消</button>
                    <button class="username-save-btn">保存</button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 显示模态框 (添加延迟以触发过渡动画)
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        
        // 让输入框获得焦点
        const input = modal.querySelector('#username-input');
        input.focus();
        input.select();
        
        // 添加关闭模态框事件
        const closeBtn = modal.querySelector('.username-close-btn');
        closeBtn.addEventListener('click', closeUsernameEditorModal);
        
        // 添加取消按钮事件
        const cancelBtn = modal.querySelector('.username-cancel-btn');
        cancelBtn.addEventListener('click', closeUsernameEditorModal);
        
        // 添加保存按钮事件
        const saveBtn = modal.querySelector('.username-save-btn');
        saveBtn.addEventListener('click', saveUsername);
        
        // 添加按键事件 (Enter键保存，Escape键取消)
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                saveUsername();
            } else if (e.key === 'Escape') {
                closeUsernameEditorModal();
            }
        });
        
        // 添加输入验证
        input.addEventListener('input', function() {
            validateUsernameInput(this);
        });
    }

    /**
     * 关闭用户名编辑模态框
     */
    function closeUsernameEditorModal() {
        const modal = document.querySelector('.username-editor-modal');
        if (!modal) return;
        
        // 移除活动类以触发关闭动画
        modal.classList.remove('active');
        
        // 动画完成后移除模态框
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    /**
     * 验证用户名输入
     * @param {HTMLInputElement} input 输入元素
     * @returns {boolean} 是否验证通过
     */
    function validateUsernameInput(input) {
        const errorElement = document.querySelector('.username-error');
        const value = input.value.trim();
        
        // 重置错误状态
        input.classList.remove('error');
        errorElement.style.display = 'none';
        
        // 检查是否为空
        if (!value) {
            input.classList.add('error');
            errorElement.textContent = '用户名不能为空';
            errorElement.style.display = 'block';
            return false;
        }
        
        // 检查长度
        if (value.length > 20) {
            input.classList.add('error');
            errorElement.textContent = '用户名不能超过20个字符';
            errorElement.style.display = 'block';
            return false;
        }
        
        return true;
    }

    /**
     * 保存用户名
     */
    function saveUsername() {
        const input = document.querySelector('#username-input');
        if (!input) return;
        
        // 验证输入
        if (!validateUsernameInput(input)) return;
        
        const newUsername = input.value.trim();
        
        // 保存到本地存储
        localStorage.setItem('username', newUsername);
        
        // 更新显示
        const usernameText = document.querySelector('.username-text');
        if (usernameText) {
            usernameText.textContent = newUsername;
        }
        
        // 关闭模态框
        closeUsernameEditorModal();
        
        // 显示成功提示
        showUsernameSuccessToast();
    }

    /**
     * 显示用户名修改成功提示
     */
    function showUsernameSuccessToast() {
        // 检查是否已存在提示，如果存在则移除
        const existingToast = document.querySelector('.username-success-toast');
        if (existingToast) existingToast.remove();
        
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'username-success-toast';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            用户名修改成功
        `;
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 显示提示 (添加延迟以触发过渡动画)
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // 3秒后自动关闭
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}); 