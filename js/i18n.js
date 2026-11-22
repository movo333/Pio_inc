// ══════════════════════════════════════════════════════════════
//  i18n — 20 لغة. الترتيب في كل صف:
//  en ar fr es pt tr id ru de it vi hi bn th ja ko zh fil pl fa
//  الصفوف القصيرة (8 عناصر) تعني: الأولى فقط مترجمة والباقي يرجع للإنجليزية
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';
var L = ['en','ar','fr','es','pt','tr','id','ru','de','it','vi','hi','bn','th','ja','ko','zh','fil','pl','fa'];
var NAMES = ['English','العربية','Français','Español','Português','Türkçe','Indonesia','Русский','Deutsch','Italiano','Tiếng Việt','हिन्दी','বাংলা','ไทย','日本語','한국어','中文','Filipino','Polski','فارسی'];
var R = {
 shopS:["Shop","المتجر","Boutique","Tienda","Loja","Mağaza","Toko","Магазин","Shop","Negozio","Cửa hàng","दुकान","দোকান","ร้านค้า","ショップ","상점","商店","Tindahan","Sklep","فروشگاه"],
 scoresS:["Scores","النتائج","Classement","Puntajes","Placar","Skorlar","Skor","Рейтинг","Bestenliste","Classifica","Xếp hạng","स्कोर","স্কোর","อันดับ","ランキング","순위","排行榜","Iskor","Wyniki","امتیازها"],
 back:["← Back","← رجوع","← Retour","← Atrás","← Voltar","← Geri","← Kembali","← Назад","← Zurück","← Indietro","← Quay lại","← वापस","← পিছনে","← กลับ","← 戻る","← 뒤로","← 返回","← Bumalik","← Wstecz","← بازگشت"],
 selWorld:["SELECT WORLD","اختر العالم","CHOISIR UN MONDE","ELIGE UN MUNDO","ESCOLHA O MUNDO","DÜNYA SEÇ","PILIH DUNIA","ВЫБЕРИ МИР","WELT WÄHLEN","SCEGLI IL MONDO","CHỌN THẾ GIỚI","दुनिया चुनें","জগৎ বেছে নিন","เลือกโลก","ワールド選択","월드 선택","选择世界","PUMILI NG MUNDO","WYBIERZ ŚWIAT","انتخاب جهان"],
 ammo:["AMMO","الذخيرة","MUNITIONS","MUNICIÓN","MUNIÇÃO","MERMİ","AMUNISI","ПАТРОНЫ","MUNITION","MUNIZIONI","ĐẠN","गोला-बारूद","গোলাবারুদ","กระสุน","弾薬","탄약","弹药","BALA","AMUNICJA","مهمات"],
 win:["🏆 YOU WIN!","🏆 فزت!","🏆 VICTOIRE !","🏆 ¡GANASTE!","🏆 VOCÊ VENCEU!","🏆 KAZANDIN!","🏆 KAMU MENANG!","🏆 ПОБЕДА!","🏆 GEWONNEN!","🏆 HAI VINTO!","🏆 BẠN THẮNG!","🏆 आप जीत गए!","🏆 আপনি জিতেছেন!","🏆 คุณชนะ!","🏆 勝利！","🏆 승리!","🏆 你赢了！","🏆 PANALO KA!","🏆 WYGRAŁEŚ!","🏆 شما برنده شدید!"],
 next:["Next","التالي","Suivant","Siguiente","Próximo","Sonraki","Lanjut","Далее","Weiter","Avanti","Tiếp","अगला","পরবর্তী","ถัดไป","次へ","다음","下一关","Susunod","Dalej","بعدی"],
 retry:["Retry","إعادة","Réessayer","Reintentar","Repetir","Tekrar","Ulangi","Заново","Nochmal","Riprova","Thử lại","फिर से","আবার","ลองใหม่","リトライ","재시도","重试","Ulitin","Ponów","تلاش مجدد"],
 over:["💀 GAME OVER","💀 انتهت اللعبة","💀 PARTIE TERMINÉE","💀 FIN DEL JUEGO","💀 FIM DE JOGO","💀 OYUN BİTTİ","💀 GAME OVER","💀 ИГРА ОКОНЧЕНА","💀 SPIEL VORBEI","💀 GAME OVER","💀 THUA CUỘC","💀 खेल समाप्त","💀 খেলা শেষ","💀 จบเกม","💀 ゲームオーバー","💀 게임 오버","💀 游戏结束","💀 TAPOS NA ANG LARO","💀 KONIEC GRY","💀 بازی تمام شد"],
 revive:["REVIVE","إحياء","REVIVRE","REVIVIR","REVIVER","CANLAN","HIDUP LAGI","ВОСКРЕСИТЬ","WIEDERBELEBEN","RIANIMA","HỒI SINH","पुनर्जीवित","পুনর্জীবিত","ชุบชีวิต","復活","부활","复活","BUMUHAY","WSKRZEŚ","احیا"],
 levels:["Levels","المراحل","Niveaux","Niveles","Fases","Seviyeler","Level","Уровни","Level","Livelli","Màn chơi","स्तर","লেভেল","ด่าน","ステージ","스테이지","关卡","Mga Level","Poziomy","مراحل"],
 paused:["⏸ PAUSED","⏸ إيقاف مؤقت","⏸ PAUSE","⏸ PAUSA","⏸ PAUSADO","⏸ DURAKLATILDI","⏸ JEDA","⏸ ПАУЗА","⏸ PAUSIERT","⏸ PAUSA","⏸ TẠM DỪNG","⏸ रुका हुआ","⏸ বিরতি","⏸ หยุดชั่วคราว","⏸ 一時停止","⏸ 일시정지","⏸ 已暂停","⏸ NAKA-PAUSE","⏸ PAUZA","⏸ توقف"],
 resume:["▶ Resume","▶ متابعة","▶ Reprendre","▶ Continuar","▶ Continuar","▶ Devam","▶ Lanjutkan","▶ Продолжить","▶ Fortsetzen","▶ Riprendi","▶ Tiếp tục","▶ जारी रखें","▶ চালিয়ে যান","▶ เล่นต่อ","▶ 再開","▶ 계속","▶ 继续","▶ Ipagpatuloy","▶ Wznów","▶ ادامه"],
 restart:["🔄 Restart","🔄 إعادة","🔄 Recommencer","🔄 Reiniciar","🔄 Reiniciar","🔄 Yeniden başlat","🔄 Mulai ulang","🔄 Заново","🔄 Neustart","🔄 Ricomincia","🔄 Chơi lại","🔄 पुनः आरंभ","🔄 রিস্টার্ট","🔄 เริ่มใหม่","🔄 やり直す","🔄 다시 시작","🔄 重新开始","🔄 I-restart","🔄 Od nowa","🔄 شروع مجدد"],
 lvlSel:["🗺️ Level Select","🗺️ اختيار المرحلة","🗺️ Choix du niveau","🗺️ Elegir nivel","🗺️ Escolher fase","🗺️ Seviye seç","🗺️ Pilih level","🗺️ Выбор уровня","🗺️ Levelauswahl","🗺️ Scegli livello","🗺️ Chọn màn","🗺️ स्तर चुनें","🗺️ লেভেল নির্বাচন","🗺️ เลือกด่าน","🗺️ ステージ選択","🗺️ 스테이지 선택","🗺️ 选择关卡","🗺️ Pumili ng Level","🗺️ Wybór poziomu","🗺️ انتخاب مرحله"],
 store:["Pi Store","متجر Pi","Boutique Pi","Tienda Pi","Loja Pi","Pi Mağazası","Toko Pi","Магазин Pi","Pi-Shop","Negozio Pi","Cửa hàng Pi","Pi स्टोर","Pi স্টোর","ร้านค้า Pi","Piストア","Pi 스토어","Pi 商店","Pi Store","Sklep Pi","فروشگاه Pi"],
 i1:["1000 Coins","1000 عملة","1000 pièces","1000 monedas","1000 moedas","1000 Sikke","1000 Koin","1000 монет","1000 Münzen","1000 monete","1000 xu","1000 सिक्के","1000 কয়েন","1000 เหรียญ","コイン1000枚","코인 1000개","1000 金币","1000 Barya","1000 monet","1000 سکه"],
 i2:["Speed Boost","تسريع الحركة","Boost de vitesse","Impulso de velocidad","Impulso de velocidade","Hız Artışı","Peningkat Kecepatan","Ускорение","Tempo-Boost","Boost velocità","Tăng tốc","गति बूस्ट","স্পিড বুস্ট","เพิ่มความเร็ว","スピードブースト","속도 부스트","加速","Dagdag-Bilis","Przyspieszenie","افزایش سرعت"],
 i3:["Unlock All Worlds","فتح كل العوالم","Débloquer tous les mondes","Desbloquear todos los mundos","Desbloquear todos os mundos","Tüm Dünyaların Kilidini Aç","Buka Semua Dunia","Открыть все миры","Alle Welten freischalten","Sblocca tutti i mondi","Mở khóa mọi thế giới","सभी दुनिया अनलॉक करें","সব জগৎ আনলক করুন","ปลดล็อกทุกโลก","全ワールド解放","모든 월드 해제","解锁所有世界","I-unlock ang Lahat ng Mundo","Odblokuj wszystkie światy","باز کردن همه جهان‌ها"],
 i4:["Mega Bundle","الحزمة الكبرى","Méga pack","Mega paquete","Mega pacote","Mega Paket","Paket Mega","Мега-набор","Mega-Paket","Mega pacchetto","Gói Mega","मेगा बंडल","মেগা বান্ডেল","แพ็กสุดคุ้ม","メガバンドル","메가 번들","超值礼包","Mega Bundle","Mega pakiet","بسته بزرگ"],
 i1d:["1000 in-game coins instantly","1000 عملة داخل اللعبة فوراً","1000 pièces de jeu instantanément","1000 monedas del juego al instante","1000 moedas do jogo na hora","Anında 1000 oyun sikkesi","1000 koin game seketika","1000 монет сразу"],
 i2d:["Move faster for this session","تحرّك أسرع في هذه الجلسة","Plus rapide pour cette session","Más rápido en esta sesión","Mais rápido nesta sessão","Bu oturum boyunca daha hızlı","Lebih cepat selama sesi ini","Быстрее на эту сессию"],
 i3d:["Access all 4 worlds instantly","ادخل العوالم الأربعة فوراً","Accédez aux 4 mondes instantanément","Accede a los 4 mundos al instante","Acesse os 4 mundos na hora","4 dünyaya anında eriş","Akses 4 dunia seketika","Доступ ко всем 4 мирам сразу"],
 i4d:["All worlds + 1000 coins","كل العوالم + 1000 عملة","Tous les mondes + 1000 pièces","Todos los mundos + 1000 monedas","Todos os mundos + 1000 moedas","Tüm dünyalar + 1000 sikke","Semua dunia + 1000 koin","Все миры + 1000 монет"],
 i5:["5 Hearts","5 قلوب","5 cœurs","5 corazones","5 corações","5 Kalp","5 Nyawa","5 сердец","5 Herzen","5 cuori","5 trái tim","5 दिल","5টি হার্ট","หัวใจ 5 ดวง","ハート5個","하트 5개","5 颗红心","5 Puso","5 serc","5 قلب"],
 i6:["Unlock Next Level","فتح المرحلة التالية","Débloquer le niveau suivant","Desbloquear siguiente nivel","Desbloquear próxima fase","Sonraki Seviyeyi Aç","Buka Level Berikutnya","Открыть следующий уровень","Nächstes Level freischalten","Sblocca livello successivo","Mở khóa màn tiếp theo","अगला स्तर अनलॉक करें","পরের লেভেল আনলক করুন","ปลดล็อกด่านถัดไป","次のステージを解放","다음 스테이지 해제","解锁下一关","I-unlock ang Susunod na Level","Odblokuj następny poziom","باز کردن مرحله بعد"],
 i7:["Unlock Next World","فتح العالم التالي","Débloquer le monde suivant","Desbloquear siguiente mundo","Desbloquear próximo mundo","Sonraki Dünyayı Aç","Buka Dunia Berikutnya","Открыть следующий мир","Nächste Welt freischalten","Sblocca mondo successivo","Mở khóa thế giới tiếp theo","अगली दुनिया अनलॉक करें","পরের জগৎ আনলক করুন","ปลดล็อกโลกถัดไป","次のワールドを解放","다음 월드 해제","解锁下一个世界","I-unlock ang Susunod na Mundo","Odblokuj następny świat","باز کردن جهان بعدی"],
 i5d:["Extra lives instantly","حياة إضافية فوراً","Vies supplémentaires immédiates","Vidas extra al instante","Vidas extras na hora","Anında ekstra can","Nyawa tambahan seketika","Дополнительные жизни сразу"],
 i6d:["Opens only the next level","يفتح المرحلة التالية فقط","Ouvre uniquement le niveau suivant","Abre solo el siguiente nivel","Abre apenas a próxima fase","Yalnızca sonraki seviyeyi açar","Hanya membuka level berikutnya","Открывает только следующий уровень"],
 i7d:["Opens only the next world","يفتح العالم التالي فقط","Ouvre uniquement le monde suivant","Abre solo el siguiente mundo","Abre apenas o próximo mundo","Yalnızca sonraki dünyayı açar","Hanya membuka dunia berikutnya","Открывает только следующий мир"],
 nothing:["Nothing left to unlock!","لا يوجد شيء آخر لفتحه!","Plus rien à débloquer !","¡No queda nada por desbloquear!","Nada mais para desbloquear!","Açılacak başka bir şey yok!","Tidak ada lagi yang bisa dibuka!","Больше нечего открывать!"],
 lb:["🏆 Leaderboard","🏆 لوحة الصدارة","🏆 Classement","🏆 Clasificación","🏆 Ranking","🏆 Sıralama","🏆 Papan Peringkat","🏆 Таблица лидеров","🏆 Bestenliste","🏆 Classifica","🏆 Bảng xếp hạng","🏆 लीडरबोर्ड","🏆 লিডারবোর্ড","🏆 กระดานผู้นำ","🏆 リーダーボード","🏆 리더보드","🏆 排行榜","🏆 Leaderboard","🏆 Ranking","🏆 جدول امتیازات"],
 lbL:["🎮 Max Level","🎮 أعلى مرحلة","🎮 Niveau max","🎮 Nivel máx.","🎮 Fase máx.","🎮 En yüksek seviye","🎮 Level Tertinggi","🎮 Макс. уровень","🎮 Höchstes Level","🎮 Livello max","🎮 Màn cao nhất","🎮 उच्चतम स्तर","🎮 সর্বোচ্চ লেভেল","🎮 ด่านสูงสุด","🎮 最高ステージ","🎮 최고 스테이지","🎮 最高关卡","🎮 Pinakamataas na Level","🎮 Maks. poziom","🎮 بالاترین مرحله"],
 lbC:["🪙 Coins","🪙 العملات","🪙 Pièces","🪙 Monedas","🪙 Moedas","🪙 Sikkeler","🪙 Koin","🪙 Монеты","🪙 Münzen","🪙 Monete","🪙 Xu","🪙 सिक्के","🪙 কয়েন","🪙 เหรียญ","🪙 コイン","🪙 코인","🪙 金币","🪙 Barya","🪙 Monety","🪙 سکه‌ها"],
 lbEmpty:["🏜️ No players yet.<br>Be the first to login with Pi!","🏜️ لا يوجد لاعبون بعد.<br>كن أول من يسجّل بـ Pi!","🏜️ Aucun joueur pour l’instant.<br>Soyez le premier à vous connecter !","🏜️ Aún no hay jugadores.<br>¡Sé el primero en entrar con Pi!","🏜️ Ainda não há jogadores.<br>Seja o primeiro a entrar com Pi!","🏜️ Henüz oyuncu yok.<br>Pi ile giriş yapan ilk kişi ol!","🏜️ Belum ada pemain.<br>Jadilah yang pertama masuk dengan Pi!","🏜️ Игроков пока нет.<br>Войдите первым через Pi!"],
 exitT:["🚪 Exit Game?","🚪 الخروج من اللعبة؟","🚪 Quitter le jeu ?","🚪 ¿Salir del juego?","🚪 Sair do jogo?","🚪 Oyundan çık?","🚪 Keluar dari game?","🚪 Выйти из игры?","🚪 Spiel beenden?","🚪 Uscire dal gioco?","🚪 Thoát game?","🚪 खेल से बाहर निकलें?","🚪 গেম থেকে বের হবেন?","🚪 ออกจากเกม?","🚪 ゲームを終了しますか？","🚪 게임을 종료할까요?","🚪 退出游戏？","🚪 Lumabas sa laro?","🚪 Wyjść z gry?","🚪 خروج از بازی؟"],
 exitS:["Are you sure you want to exit?","هل تريد الخروج فعلاً؟","Voulez-vous vraiment quitter ?","¿Seguro que quieres salir?","Tem certeza que deseja sair?","Çıkmak istediğine emin misin?","Yakin ingin keluar?","Точно хотите выйти?","Wirklich beenden?","Vuoi davvero uscire?","Bạn chắc muốn thoát?","क्या आप सच में बाहर निकलना चाहते हैं?","আপনি কি নিশ্চিত বের হবেন?","แน่ใจหรือว่าจะออก?","本当に終了しますか？","정말 종료할까요?","确定要退出吗？","Sigurado ka bang lalabas?","Na pewno wyjść?","مطمئنید می‌خواهید خارج شوید؟"],
 yes:["Yes","نعم","Oui","Sí","Sim","Evet","Ya","Да","Ja","Sì","Có","हाँ","হ্যাঁ","ใช่","はい","예","是","Oo","Tak","بله"],
 no:["No","لا","Non","No","Não","Hayır","Tidak","Нет","Nein","No","Không","नहीं","না","ไม่","いいえ","아니요","否","Hindi","Nie","خیر"],
 loading:["Loading... {p}%","جارٍ التحميل... {p}%","Chargement... {p}%","Cargando... {p}%","Carregando... {p}%","Yükleniyor... {p}%","Memuat... {p}%","Загрузка... {p}%","Laden... {p}%","Caricamento... {p}%","Đang tải... {p}%","लोड हो रहा है... {p}%","লোড হচ্ছে... {p}%","กำลังโหลด... {p}%","読み込み中... {p}%","로딩 중... {p}%","加载中... {p}%","Naglo-load... {p}%","Ładowanie... {p}%","در حال بارگذاری... {p}%"],
 ready:["Ready!","جاهز!","Prêt !","¡Listo!","Pronto!","Hazır!","Siap!","Готово!","Bereit!","Pronto!","Sẵn sàng!","तैयार!","প্রস্তুত!","พร้อมแล้ว!","準備完了！","준비 완료!","准备就绪！","Handa na!","Gotowe!","آماده!"],
 ldMsg:["Please wait...","يرجى الانتظار...","Veuillez patienter...","Espera un momento...","Aguarde...","Lütfen bekleyin...","Harap tunggu...","Подождите...","Bitte warten...","Attendi...","Vui lòng đợi...","कृपया प्रतीक्षा करें...","অনুগ্রহ করে অপেক্ষা করুন...","โปรดรอสักครู่...","お待ちください...","잠시만 기다려 주세요...","请稍候...","Pakihintay...","Proszę czekać...","لطفاً صبر کنید..."],
 ldCache:["Files download once, then are saved on your device.","الملفات تُحمَّل مرة واحدة ثم تُحفَظ على الذاكرة.","Les fichiers sont téléchargés une seule fois, puis enregistrés sur l’appareil.","Los archivos se descargan una sola vez y se guardan en el dispositivo.","Os arquivos são baixados uma vez e salvos no dispositivo.","Dosyalar bir kez indirilir, sonra cihazda saklanır.","File diunduh sekali, lalu disimpan di perangkat.","Файлы загружаются один раз и сохраняются на устройстве.","Dateien werden einmal geladen und dann auf dem Gerät gespeichert.","I file si scaricano una volta e restano salvati sul dispositivo.","Tệp chỉ tải một lần, sau đó được lưu trên thiết bị.","फ़ाइलें एक बार डाउनलोड होती हैं, फिर डिवाइस में सहेजी जाती हैं।","ফাইল একবার ডাউনলোড হয়, তারপর ডিভাইসে সংরক্ষিত থাকে।","ไฟล์จะดาวน์โหลดครั้งเดียว แล้วบันทึกไว้ในเครื่อง","ファイルは一度だけダウンロードされ、端末に保存されます。","파일은 한 번만 다운로드되고 기기에 저장됩니다.","文件只下载一次，之后保存在设备上。","Isang beses lang magda-download ang mga file, tapos ise-save sa device.","Pliki pobierają się raz, potem są zapisywane na urządzeniu.","فایل‌ها یک بار دانلود می‌شوند و سپس روی دستگاه ذخیره می‌شوند."],
 piSub:["Sign in to save your progress and join the leaderboard!","سجّل الدخول لحفظ تقدمك والمنافسة في لوحة الصدارة!","Connectez-vous pour sauvegarder votre progression et entrer au classement !","¡Inicia sesión para guardar tu progreso y entrar al ranking!","Entre para salvar seu progresso e participar do ranking!","İlerlemeni kaydetmek ve sıralamaya girmek için giriş yap!","Masuk untuk menyimpan progres dan ikut papan peringkat!","Войдите, чтобы сохранять прогресс и попасть в рейтинг!","Melde dich an, um deinen Fortschritt zu speichern und in die Bestenliste zu kommen!","Accedi per salvare i progressi ed entrare in classifica!","Đăng nhập để lưu tiến trình và vào bảng xếp hạng!","प्रगति सहेजने और लीडरबोर्ड में शामिल होने के लिए साइन इन करें!","অগ্রগতি সংরক্ষণ ও লিডারবোর্ডে যোগ দিতে সাইন ইন করুন!","เข้าสู่ระบบเพื่อบันทึกความคืบหน้าและติดอันดับ!","ログインして進行状況を保存し、ランキングに参加しよう！","로그인하여 진행 상황을 저장하고 리더보드에 참여하세요!","登录以保存进度并加入排行榜！","Mag-sign in para i-save ang progreso at sumali sa leaderboard!","Zaloguj się, aby zapisać postępy i dołączyć do rankingu!","برای ذخیره پیشرفت و ورود به جدول امتیازات وارد شوید!"],
 login:["🔐 Login with Pi Network","🔐 الدخول عبر Pi Network","🔐 Connexion avec Pi Network","🔐 Entrar con Pi Network","🔐 Entrar com Pi Network","🔐 Pi Network ile giriş","🔐 Masuk dengan Pi Network","🔐 Войти через Pi Network","🔐 Mit Pi Network anmelden","🔐 Accedi con Pi Network","🔐 Đăng nhập bằng Pi Network","🔐 Pi Network से लॉगिन करें","🔐 Pi Network দিয়ে লগইন","🔐 เข้าสู่ระบบด้วย Pi Network","🔐 Pi Networkでログイン","🔐 Pi Network로 로그인","🔐 使用 Pi Network 登录","🔐 Mag-login gamit ang Pi Network","🔐 Zaloguj przez Pi Network","🔐 ورود با Pi Network"],
 guest:["🕹️ Play as Guest (no save)","🕹️ العب كضيف (بدون حفظ)","🕹️ Jouer en invité (sans sauvegarde)","🕹️ Jugar como invitado (sin guardar)","🕹️ Jogar como convidado (sem salvar)","🕹️ Misafir olarak oyna (kayıt yok)","🕹️ Main sebagai tamu (tanpa simpan)","🕹️ Играть как гость (без сохранения)","🕹️ Als Gast spielen (ohne Speichern)","🕹️ Gioca come ospite (senza salvare)","🕹️ Chơi khách (không lưu)","🕹️ अतिथि के रूप में खेलें (सेव नहीं)","🕹️ অতিথি হিসেবে খেলুন (সেভ হবে না)","🕹️ เล่นแบบผู้เยี่ยมชม (ไม่บันทึก)","🕹️ ゲストで遊ぶ（保存なし）","🕹️ 게스트로 플레이 (저장 안 됨)","🕹️ 游客试玩（不保存）","🕹️ Maglaro bilang Guest (walang save)","🕹️ Graj jako gość (bez zapisu)","🕹️ بازی به‌عنوان مهمان (بدون ذخیره)"],
 req:["Requires Pi Browser","يتطلب Pi Browser","Nécessite Pi Browser","Requiere Pi Browser","Requer Pi Browser","Pi Browser gerekir","Memerlukan Pi Browser","Нужен Pi Browser","Pi Browser erforderlich","Richiede Pi Browser","Cần Pi Browser","Pi Browser आवश्यक","Pi Browser প্রয়োজন","ต้องใช้ Pi Browser","Pi Browserが必要","Pi Browser 필요","需要 Pi Browser","Kailangan ng Pi Browser","Wymaga Pi Browser","نیاز به Pi Browser"],
 w1:["Nature","الطبيعة","Nature","Naturaleza","Natureza","Doğa","Alam","Природа","Natur","Natura","Thiên nhiên","प्रकृति","প্রকৃতি","ธรรมชาติ","自然","자연","自然","Kalikasan","Natura","طبیعت"],
 w2:["Graveyard","المقبرة","Cimetière","Cementerio","Cemitério","Mezarlık","Pemakaman","Кладбище","Friedhof","Cimitero","Nghĩa địa","कब्रिस्तान","কবরস্থান","สุสาน","墓地","묘지","墓地","Libingan","Cmentarz","گورستان"],
 w3:["Winter","الشتاء","Hiver","Invierno","Inverno","Kış","Musim Dingin","Зима","Winter","Inverno","Mùa đông","सर्दी","শীত","ฤดูหนาว","冬","겨울","冬季","Taglamig","Zima","زمستان"],
 w4:["Desert","الصحراء","Désert","Desierto","Deserto","Çöl","Gurun","Пустыня","Wüste","Deserto","Sa mạc","रेगिस्तान","মরুভূমি","ทะเลทราย","砂漠","사막","沙漠","Disyerto","Pustynia","بیابان"],
 rLives:["Out of lives!","نفدت الأرواح!","Plus de vies !","¡Sin vidas!","Sem vidas!","Canın kalmadı!","Nyawa habis!","Жизни кончились!","Keine Leben mehr!","Vite finite!","Hết mạng!","जीवन समाप्त!","প্রাণ শেষ!","หมดชีวิต!","ライフ切れ！","목숨이 없어요!","生命用尽！","Naubos ang buhay!","Brak żyć!","جان‌ها تمام شد!"],
 rSpike:["Hit a spike!","اصطدمت بالأشواك!","Touché par un piège !","¡Chocaste con pinchos!","Bateu nos espinhos!","Dikene çarptın!","Terkena duri!","Наткнулся на шипы!","In Stacheln gelaufen!","Hai toccato le spine!","Dính bẫy gai!","कांटों से टकराए!","কাঁটায় লেগেছে!","ชนหนาม!","トゲに当たった！","가시에 닿았어요!","碰到尖刺！","Natamaan ng tinik!","Najechałeś na kolce!","به خار خوردید!"],
 rTime:["Time's up!","انتهى الوقت!","Temps écoulé !","¡Se acabó el tiempo!","Tempo esgotado!","Süre doldu!","Waktu habis!","Время вышло!","Zeit abgelaufen!","Tempo scaduto!","Hết giờ!","समय समाप्त!","সময় শেষ!","หมดเวลา!","時間切れ！","시간 초과!","时间到！","Tapos na ang oras!","Koniec czasu!","زمان تمام شد!"],
 openPi:["Please open the game in Pi Browser.","يرجى فتح اللعبة داخل Pi Browser.","Veuillez ouvrir le jeu dans Pi Browser.","Abre el juego en Pi Browser.","Abra o jogo no Pi Browser.","Lütfen oyunu Pi Browser’da açın.","Harap buka game di Pi Browser.","Откройте игру в Pi Browser."],
 loginBuy:["🔐 Please login with Pi Network to purchase!","🔐 سجّل الدخول عبر Pi Network لإتمام الشراء!","🔐 Connectez-vous avec Pi Network pour acheter !","🔐 ¡Inicia sesión con Pi Network para comprar!","🔐 Entre com Pi Network para comprar!","🔐 Satın almak için Pi Network ile giriş yapın!","🔐 Masuk dengan Pi Network untuk membeli!","🔐 Войдите через Pi Network, чтобы купить!"],
 buyOk:["✅ Purchase successful!","✅ تمت عملية الشراء بنجاح!","✅ Achat réussi !","✅ ¡Compra exitosa!","✅ Compra realizada!","✅ Satın alma başarılı!","✅ Pembelian berhasil!","✅ Покупка прошла успешно!"],
 payErr:["❌ Payment error. Please try again.","❌ خطأ في الدفع. حاول مرة أخرى.","❌ Erreur de paiement. Réessayez.","❌ Error de pago. Inténtalo de nuevo.","❌ Erro no pagamento. Tente novamente.","❌ Ödeme hatası. Tekrar deneyin.","❌ Kesalahan pembayaran. Coba lagi.","❌ Ошибка оплаты. Повторите попытку."],
 notConf:["⚠️ Payment not confirmed yet. Reopen the game to finish it (no double charge).","⚠️ لم يتأكد الدفع بعد. أعد فتح اللعبة لإكماله (لن يُخصم مرتين).","⚠️ Paiement non confirmé. Rouvrez le jeu pour terminer (pas de double débit).","⚠️ Pago aún sin confirmar. Reabre el juego para terminar (sin doble cobro).","⚠️ Pagamento ainda não confirmado. Reabra o jogo para concluir (sem cobrança dupla).","⚠️ Ödeme henüz onaylanmadı. Tamamlamak için oyunu yeniden açın (çift ücret yok).","⚠️ Pembayaran belum dikonfirmasi. Buka ulang game untuk menyelesaikan (tanpa tagihan ganda).","⚠️ Платёж ещё не подтверждён. Откройте игру снова, чтобы завершить (без двойного списания)."]
};

var KEY = 'spio_lang', cur = 'en', idx = 0, REV = {};
for (var k in R) REV[R[k][0]] = k;
REV['Loading...'] = 'loading0';

function detect() {
  var s = ''; try { s = localStorage.getItem(KEY) || ''; } catch (e) {}
  if (L.indexOf(s) >= 0) return s;
  var n = ((navigator.language || 'en') + '').toLowerCase().slice(0, 2);
  if (n === 'tl') n = 'fil';
  return L.indexOf(n) >= 0 ? n : 'en';
}
cur = detect(); idx = L.indexOf(cur);

function i18n(key, vars) {
  var raw = key === 'loading0' ? 'loading' : key, r = R[raw];
  if (!r) return key;
  var s = r[idx] || r[0];
  if (key === 'loading0') s = s.replace(/\s*\{p\}%/, '');
  if (vars) for (var v in vars) s = s.split('{' + v + '}').join(vars[v]);
  return s;
}
function i18nText(en) { return REV[en] ? i18n(REV[en]) : en; }

function applyLang() {
  document.documentElement.lang = cur;
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      var p = n.parentNode && n.parentNode.nodeName;
      return (p === 'SCRIPT' || p === 'STYLE' || p === 'PRE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  var n;
  while ((n = w.nextNode())) {
    var key = n.__k;
    if (!key) {
      var s = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!s || !REV[s]) continue;
      key = n.__k = REV[s];
      n.__lead = n.nodeValue.match(/^\s*/)[0];
      n.__trail = n.nodeValue.match(/\s*$/)[0];
    }
    n.nodeValue = n.__lead + i18n(key) + n.__trail;
  }
}

function buildBar(id) {
  var el = document.getElementById(id); if (!el) return;
  var old = el.querySelector('.langbar'); if (old) old.parentNode.removeChild(old);
  var bar = document.createElement('div');
  bar.className = 'langbar';
  bar.style.cssText = 'position:relative;z-index:5;display:flex;flex-wrap:wrap;justify-content:center;gap:5px;max-width:340px;margin-top:14px;padding:0 6px;';
  L.forEach(function (c, i) {
    var b = document.createElement('button');
    b.textContent = NAMES[i];
    b.style.cssText = 'padding:5px 9px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ' +
      (c === cur ? '#FFD700;background:#FFD700;color:#222' : 'rgba(255,255,255,.35);background:rgba(0,0,0,.35);color:#fff');
    b.onclick = function (e) { if (e) e.stopPropagation(); setLang(c); };
    bar.appendChild(b);
  });
  el.appendChild(bar);
}
function setLang(c) {
  if (L.indexOf(c) < 0) return;
  cur = c; idx = L.indexOf(c);
  try { localStorage.setItem(KEY, c); } catch (e) {}
  applyLang(); buildBar('loadingScreen'); buildBar('piLogin');
  try { if (typeof buildWorldGrid === 'function') buildWorldGrid(); } catch (e) {}
}
function init() { applyLang(); buildBar('loadingScreen'); buildBar('piLogin'); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

window.i18n = i18n; window.i18nText = i18nText; window.setLang = setLang;
window.I18N_LANGS = L; window.I18N_ROWS = R;
})();
