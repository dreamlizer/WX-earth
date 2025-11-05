// assets/cities_data.js
// 我们的“城市数据库”，为每个城市增加了 country_code (国家三字码)

export const cities = [
  // --- 中国 (10) - 高重要性 ---
  { lat: 39.9042, lon: 116.4074, name_en: 'Beijing', name_zh: '北京', importance: 2, country_code: 'CHN' },
  { lat: 31.2304, lon: 121.4737, name_en: 'Shanghai', name_zh: '上海', importance: 2, country_code: 'CHN' },
  { lat: 23.1291, lon: 113.2644, name_en: 'Guangzhou', name_zh: '广州', importance: 2, country_code: 'CHN' },
  { lat: 22.5431, lon: 114.0579, name_en: 'Shenzhen', name_zh: '深圳', importance: 2, country_code: 'CHN' },
  { lat: 30.5728, lon: 104.0668, name_en: 'Chengdu', name_zh: '成都', importance: 2, country_code: 'CHN' },
  { lat: 29.5630, lon: 106.5516, name_en: 'Chongqing', name_zh: '重庆', importance: 2, country_code: 'CHN' },
  { lat: 30.6622, lon: 114.3055, name_en: 'Wuhan', name_zh: '武汉', importance: 2, country_code: 'CHN' },
  { lat: 34.3416, lon: 108.9402, name_en: 'Xi\'an', name_zh: '西安', importance: 2, country_code: 'CHN' },
  { lat: 30.2741, lon: 120.1551, name_en: 'Hangzhou', name_zh: '杭州', importance: 2, country_code: 'CHN' },
  { lat: 29.6456, lon: 91.1402, name_en: 'Lhasa', name_zh: '拉萨', importance: 2, country_code: 'CHN' },

  // --- 美国 (扩充) - 高重要性 ---
  { lat: 40.7128, lon: -74.0060, name_en: 'New York', name_zh: '纽约', importance: 2, country_code: 'USA' },
  { lat: 41.8781, lon: -87.6298, name_en: 'Chicago', name_zh: '芝加哥', importance: 2, country_code: 'USA' },
  { lat: 39.7392, lon: -104.9903, name_en: 'Denver', name_zh: '丹佛', importance: 2, country_code: 'USA' },
  { lat: 34.0522, lon: -118.2437, name_en: 'Los Angeles', name_zh: '洛杉矶', importance: 2, country_code: 'USA' },
  { lat: 61.2181, lon: -149.9003, name_en: 'Anchorage', name_zh: '安克雷奇', importance: 2, country_code: 'USA' },
  { lat: 21.3069, lon: -157.8583, name_en: 'Honolulu', name_zh: '檀香山', importance: 2, country_code: 'USA' },
  { lat: 38.9072, lon: -77.0369, name_en: 'Washington D.C.', name_zh: '华盛顿', importance: 2, country_code: 'USA' },
  { lat: 29.7604, lon: -95.3698, name_en: 'Houston', name_zh: '休斯顿', importance: 2, country_code: 'USA' },
  { lat: 47.6062, lon: -122.3321, name_en: 'Seattle', name_zh: '西雅图', importance: 2, country_code: 'USA' },
  { lat: 25.7617, lon: -80.1918, name_en: 'Miami', name_zh: '迈阿密', importance: 2, country_code: 'USA' },

  // --- 俄罗斯 (扩充) - 高重要性 ---
  { lat: 55.7558, lon: 37.6173, name_en: 'Moscow', name_zh: '莫斯科', importance: 2, country_code: 'RUS' },
  { lat: 59.9343, lon: 30.3351, name_en: 'St. Petersburg', name_zh: '圣彼得堡', importance: 2, country_code: 'RUS' },
  { lat: 56.8389, lon: 60.6057, name_en: 'Yekaterinburg', name_zh: '叶卡捷琳堡', importance: 2, country_code: 'RUS' },
  { lat: 55.0084, lon: 82.9357, name_en: 'Novosibirsk', name_zh: '新西伯利亚', importance: 2, country_code: 'RUS' },
  { lat: 43.1198, lon: 131.8869, name_en: 'Vladivostok', name_zh: '符拉迪沃斯托克', importance: 2, country_code: 'RUS' },

      // --- 加拿大 (扩充) -  ---
// 加拿大首都
{ lat: 45.4215, lon: -75.6997, name_en: 'Ottawa', name_zh: '渥太华', importance: 1, country_code: 'CAN', timezone: 'America/Toronto' }, // 首都，东部时区
{ lat: 43.6510, lon: -79.3470, name_en: 'Toronto', name_zh: '多伦多', importance: 1, country_code: 'CAN', timezone: 'America/Toronto' }, // 最大城市，东部时区
{ lat: 45.5017, lon: -73.5673, name_en: 'Montreal', name_zh: '蒙特利尔', importance: 1, country_code: 'CAN', timezone: 'America/Toronto' }, // 第二大城市，东部时区
{ lat: 49.8951, lon: -97.1384, name_en: 'Winnipeg', name_zh: '温尼伯', importance: 1, country_code: 'CAN', timezone: 'America/Winnipeg' }, // 曼尼托巴省会，中部时区
{ lat: 51.0447, lon: -114.0719, name_en: 'Calgary', name_zh: '卡尔加里', importance: 1, country_code: 'CAN', timezone: 'America/Edmonton' }, // 阿尔伯塔省，山区时区
{ lat: 49.2827, lon: -123.1207, name_en: 'Vancouver', name_zh: '温哥华', importance: 1, country_code: 'CAN', timezone: 'America/Vancouver' }, // 不列颠哥伦比亚省，太平洋时区


  // --- 印度 (扩充) - 高重要性 ---
  { lat: 28.6139, lon: 77.2090, name_en: 'New Delhi', name_zh: '新德里', importance: 2, country_code: 'IND' },
  { lat: 19.0760, lon: 72.8777, name_en: 'Mumbai', name_zh: '孟买', importance: 2, country_code: 'IND' },
  { lat: 12.9716, lon: 77.5946, name_en: 'Bangalore', name_zh: '班加罗尔', importance: 2, country_code: 'IND' },
  { lat: 22.5726, lon: 88.3639, name_en: 'Kolkata', name_zh: '加尔各答', importance: 2, country_code: 'IND' },

  // --- 澳大利亚 (扩充) - 高重要性 ---
  { lat: -33.8688, lon: 151.2093, name_en: 'Sydney', name_zh: '悉尼', importance: 2, country_code: 'AUS' },
  { lat: -37.8136, lon: 144.9631, name_en: 'Melbourne', name_zh: '墨尔本', importance: 2, country_code: 'AUS' },
  { lat: -27.4698, lon: 153.0251, name_en: 'Brisbane', name_zh: '布里斯班', importance: 2, country_code: 'AUS' },
  { lat: -31.9505, lon: 115.8605, name_en: 'Perth', name_zh: '珀斯', importance: 2, country_code: 'AUS' },

  // --- 重要岛屿和领地 - 高重要性 ---
  { lat: 13.4443, lon: 144.7937, name_en: 'Guam', name_zh: '关岛', importance: 2, country_code: 'GUM' },
  { lat: 18.2208, lon: -66.5901, name_en: 'Puerto Rico', name_zh: '波多黎各', importance: 2, country_code: 'PRI' },



// --- 新增的重要岛屿和领地 ---
  { lat: 64.1836, lon: -51.7216, name_en: 'Nuuk', name_zh: '努克', importance: 1, country_code: 'GRL' }, // Greenland
  { lat: -21.2078, lon: 165.289, name_en: 'Nouméa', name_zh: '努美阿', importance: 1, country_code: 'NCL' }, // New Caledonia
  { lat: -51.7000, lon: -57.8500, name_en: 'Stanley', name_zh: '斯坦利', importance: 1, country_code: 'FLK' }, // Falkland Islands
  { lat: -20.8823, lon: 55.4504, name_en: 'Saint-Denis', name_zh: '圣但尼', importance: 1, country_code: 'REU' }, // Réunion
  { lat: 14.6049, lon: -61.0718, name_en: 'Fort-de-France', name_zh: '法兰西堡', importance: 1, country_code: 'MTQ' }, // Martinique
  { lat: 62.0097, lon: -6.7726, name_en: 'Tórshavn', name_zh: '托尔斯港', importance: 1, country_code: 'FRO' }, // Faroe Islands
  { lat: 15.214, lon: 145.756, name_en: 'Saipan', name_zh: '塞班', importance: 1, country_code: 'MNP' }, // Northern Mariana Islands
  { lat: 18.339, lon: -64.933, name_en: 'Charlotte Amalie', name_zh: '夏洛特阿马利亚', importance: 1, country_code: 'VIR' }, // U.S. Virgin Islands
  // --- 世界各国首都 ---
 // --- 非洲首都 ---
  { lat: 36.7528, lon: 3.0422, name_en: 'Algiers', name_zh: '阿尔及尔', importance: 1, country_code: 'DZA' }, // Algeria
{ lat: -8.8390, lon: 13.2894, name_en: 'Luanda', name_zh: '罗安达', importance: 1, country_code: 'AGO' }, // Angola
{ lat: 6.4969, lon: 2.6289, name_en: 'Porto-Novo', name_zh: '波多诺伏', importance: 1, country_code: 'BEN' }, // Benin
{ lat: -24.6581, lon: 25.9122, name_en: 'Gaborone', name_zh: '哈博罗内', importance: 1, country_code: 'BWA' }, // Botswana
{ lat: 12.3642, lon: -1.5383, name_en: 'Ouagadougou', name_zh: '瓦加杜古', importance: 1, country_code: 'BFA' }, // Burkina Faso
{ lat: -3.4264, lon: 29.9256, name_en: 'Gitega', name_zh: '基特加', importance: 1, country_code: 'BDI' }, // Burundi
{ lat: 3.8480, lon: 11.5021, name_en: 'Yaoundé', name_zh: '雅温得', importance: 1, country_code: 'CMR' }, // Cameroon
{ lat: 14.9331, lon: -23.5133, name_en: 'Praia', name_zh: '普拉亚', importance: 1, country_code: 'CPV' }, // Cape Verde
{ lat: 4.3947, lon: 18.5582, name_en: 'Bangui', name_zh: '班吉', importance: 1, country_code: 'CAF' }, // Central African Republic
{ lat: 12.1348, lon: 15.0557, name_en: "N'Djamena", name_zh: '恩贾梅纳', importance: 1, country_code: 'TCD' }, // Chad
{ lat: -11.6982, lon: 43.2536, name_en: 'Moroni', name_zh: '莫罗尼', importance: 1, country_code: 'COM' }, // Comoros
{ lat: -4.3250, lon: 15.3222, name_en: 'Kinshasa', name_zh: '金沙萨', importance: 1, country_code: 'COD' }, // DR Congo
{ lat: -4.2634, lon: 15.2429, name_en: 'Brazzaville', name_zh: '布拉柴维尔', importance: 1, country_code: 'COG' }, // Congo
{ lat: 11.5890, lon: 43.1450, name_en: 'Djibouti', name_zh: '吉布提', importance: 1, country_code: 'DJI' }, // Djibouti
{ lat: 30.0444, lon: 31.2357, name_en: 'Cairo', name_zh: '开罗', importance: 1, country_code: 'EGY' }, // Egypt
{ lat: 3.7500, lon: 8.7833, name_en: 'Malabo', name_zh: '马拉博', importance: 1, country_code: 'GNQ' }, // Equatorial Guinea
{ lat: 15.3333, lon: 38.9333, name_en: 'Asmara', name_zh: '阿斯马拉', importance: 1, country_code: 'ERI' }, // Eritrea
{ lat: -26.3054, lon: 31.1367, name_en: 'Mbabane', name_zh: '姆巴巴内', importance: 1, country_code: 'SWZ' }, // Eswatini
{ lat: 9.0300, lon: 38.7400, name_en: 'Addis Ababa', name_zh: '亚的斯亚贝巴', importance: 1, country_code: 'ETH' }, // Ethiopia
{ lat: 0.3901, lon: 9.4544, name_en: 'Libreville', name_zh: '利伯维尔', importance: 1, country_code: 'GAB' }, // Gabon
{ lat: 13.4549, lon: -16.5790, name_en: 'Banjul', name_zh: '班珠尔', importance: 1, country_code: 'GMB' }, // Gambia
{ lat: 9.6412, lon: -13.5784, name_en: 'Conakry', name_zh: '科纳克里', importance: 1, country_code: 'GIN' }, // Guinea
{ lat: 11.8636, lon: -15.5977, name_en: 'Bissau', name_zh: '比绍', importance: 1, country_code: 'GNB' }, // Guinea-Bissau
{ lat: 6.3133, lon: -10.8014, name_en: 'Monrovia', name_zh: '蒙罗维亚', importance: 1, country_code: 'LBR' }, // Liberia
{ lat: 32.8872, lon: 13.1913, name_en: 'Tripoli', name_zh: '的黎波里', importance: 1, country_code: 'LBY' }, // Libya
{ lat: -18.8792, lon: 47.5079, name_en: 'Antananarivo', name_zh: '塔那那利佛', importance: 1, country_code: 'MDG' }, // Madagascar
{ lat: -13.9626, lon: 33.7741, name_en: 'Lilongwe', name_zh: '利隆圭', importance: 1, country_code: 'MWI' }, // Malawi
{ lat: 12.6392, lon: -8.0029, name_en: 'Bamako', name_zh: '巴马科', importance: 1, country_code: 'MLI' }, // Mali
{ lat: 18.0783, lon: -15.9744, name_en: 'Nouakchott', name_zh: '努瓦克肖特', importance: 1, country_code: 'MRT' }, // Mauritania
{ lat: -20.1609, lon: 57.5012, name_en: 'Port Louis', name_zh: '路易港', importance: 1, country_code: 'MUS' }, // Mauritius
{ lat: -25.9692, lon: 32.5732, name_en: 'Maputo', name_zh: '马普托', importance: 1, country_code: 'MOZ' }, // Mozambique
{ lat: -22.5597, lon: 17.0832, name_en: 'Windhoek', name_zh: '温得和克', importance: 1, country_code: 'NAM' }, // Namibia
{ lat: 13.5128, lon: 2.1126, name_en: 'Niamey', name_zh: '尼亚美', importance: 1, country_code: 'NER' }, // Niger
{ lat: 9.0579, lon: 7.4951, name_en: 'Abuja', name_zh: '阿布贾', importance: 1, country_code: 'NGA' }, // Nigeria
{ lat: -1.2921, lon: 36.8219, name_en: 'Nairobi', name_zh: '内罗毕', importance: 1, country_code: 'KEN' }, // Kenya
{ lat: -29.3158, lon: 27.4854, name_en: 'Maseru', name_zh: '马塞卢', importance: 1, country_code: 'LSO' }, // Lesotho
{ lat: 34.0209, lon: -6.8416, name_en: 'Rabat', name_zh: '拉巴特', importance: 1, country_code: 'MAR' }, // Morocco
{ lat: -2.1540, lon: 30.5350, name_en: 'Kigali', name_zh: '基加利', importance: 1, country_code: 'RWA' }, // Rwanda
{ lat: 0.3365, lon: 6.7273, name_en: 'Sao Tome', name_zh: '圣多美', importance: 1, country_code: 'STP' }, // Sao Tome and Principe
{ lat: 14.6928, lon: -17.4467, name_en: 'Dakar', name_zh: '达喀尔', importance: 1, country_code: 'SEN' }, // Senegal
{ lat: -4.6191, lon: 55.4513, name_en: 'Victoria', name_zh: '维多利亚', importance: 1, country_code: 'SYC' }, // Seychelles
{ lat: 8.4657, lon: -13.2317, name_en: 'Freetown', name_zh: '弗里敦', importance: 1, country_code: 'SLE' }, // Sierra Leone
{ lat: 2.0469, lon: 45.3182, name_en: 'Mogadishu', name_zh: '摩加迪沙', importance: 1, country_code: 'SOM' }, // Somalia
{ lat: -25.7461, lon: 28.1881, name_en: 'Pretoria', name_zh: '比勒陀利亚', importance: 1, country_code: 'ZAF' }, // South Africa (行政)
{ lat: -33.9258, lon: 18.4232, name_en: 'Cape Town', name_zh: '开普敦', importance: 0.5, country_code: 'ZAF' }, // South Africa (立法)
{ lat: -29.1184, lon: 26.2294, name_en: 'Bloemfontein', name_zh: '布隆方丹', importance: 0.5, country_code: 'ZAF' }, // South Africa (司法)
{ lat: 4.8594, lon: 31.5713, name_en: 'Juba', name_zh: '朱巴', importance: 1, country_code: 'SSD' }, // South Sudan
{ lat: 15.5007, lon: 32.5599, name_en: 'Khartoum', name_zh: '喀土穆', importance: 1, country_code: 'SDN' }, // Sudan
{ lat: -6.1630, lon: 35.7516, name_en: 'Dodoma', name_zh: '多多马', importance: 1, country_code: 'TZA' }, // Tanzania
{ lat: 6.1319, lon: 1.2220, name_en: 'Lomé', name_zh: '洛美', importance: 1, country_code: 'TGO' }, // Togo
{ lat: 36.8065, lon: 10.1815, name_en: 'Tunis', name_zh: '突尼斯', importance: 1, country_code: 'TUN' }, // Tunisia
{ lat: 0.3476, lon: 32.5825, name_en: 'Kampala', name_zh: '坎帕拉', importance: 1, country_code: 'UGA' }, // Uganda
{ lat: -15.4167, lon: 28.2833, name_en: 'Lusaka', name_zh: '卢萨卡', importance: 1, country_code: 'ZMB' }, // Zambia
{ lat: -17.8292, lon: 31.0522, name_en: 'Harare', name_zh: '哈拉雷', importance: 1, country_code: 'ZWE' }, // Zimbabwe
{ lat: 7.5460, lon: -5.5471, name_en: 'Yamoussoukro', name_zh: '亚穆苏克罗', importance: 1, country_code: 'CIV' }, // Côte d'Ivoire
{ lat: 5.6037, lon: -0.1870, name_en: 'Accra', name_zh: '阿克拉', importance: 1, country_code: 'GHA' }, // Ghana



// --- 亚洲首都 ---
{ lat: 34.5553, lon: 69.2075, name_en: 'Kabul', name_zh: '喀布尔', importance: 1, country_code: 'AFG' }, // Afghanistan
{ lat: 40.1792, lon: 44.4991, name_en: 'Yerevan', name_zh: '埃里温', importance: 1, country_code: 'ARM' }, // Armenia
{ lat: 40.4093, lon: 49.8671, name_en: 'Baku', name_zh: '巴库', importance: 1, country_code: 'AZE' }, // Azerbaijan
{ lat: 26.2285, lon: 50.5860, name_en: 'Manama', name_zh: '麦纳麦', importance: 1, country_code: 'BHR' }, // Bahrain
{ lat: 23.8103, lon: 90.4125, name_en: 'Dhaka', name_zh: '达卡', importance: 1, country_code: 'BGD' }, // Bangladesh
{ lat: 27.4728, lon: 89.6390, name_en: 'Thimphu', name_zh: '廷布', importance: 1, country_code: 'BTN' }, // Bhutan
{ lat: 4.9031, lon: 114.9398, name_en: 'Bandar Seri Begawan', name_zh: '斯里巴加湾市', importance: 1, country_code: 'BRN' }, // Brunei
{ lat: 12.5657, lon: 104.9910, name_en: 'Phnom Penh', name_zh: '金边', importance: 1, country_code: 'KHM' }, // Cambodia
{ lat: 35.1796, lon: 33.3823, name_en: 'Nicosia', name_zh: '尼科西亚', importance: 1, country_code: 'CYP' }, // Cyprus
{ lat: 41.7151, lon: 44.8271, name_en: 'Tbilisi', name_zh: '第比利斯', importance: 1, country_code: 'GEO' }, // Georgia
{ lat: 28.6139, lon: 77.2090, name_en: 'New Delhi', name_zh: '新德里', importance: 1, country_code: 'IND' }, // India
{ lat: -6.2088, lon: 106.8456, name_en: 'Jakarta', name_zh: '雅加达', importance: 1, country_code: 'IDN' }, // Indonesia
{ lat: 35.6892, lon: 51.3890, name_en: 'Tehran', name_zh: '德黑兰', importance: 1, country_code: 'IRN' }, // Iran
{ lat: 33.3152, lon: 44.3661, name_en: 'Baghdad', name_zh: '巴格达', importance: 1, country_code: 'IRQ' }, // Iraq
{ lat: 31.7683, lon: 35.2137, name_en: 'Jerusalem', name_zh: '耶路撒冷', importance: 1, country_code: 'ISR' }, // Israel（国际争议）
{ lat: 35.6895, lon: 139.6917, name_en: 'Tokyo', name_zh: '东京', importance: 1, country_code: 'JPN' }, // Japan
{ lat: 31.9632, lon: 35.9304, name_en: 'Amman', name_zh: '安曼', importance: 1, country_code: 'JOR' }, // Jordan
{ lat: 51.1694, lon: 71.4491, name_en: 'Astana', name_zh: '阿斯塔纳', importance: 1, country_code: 'KAZ' }, // Kazakhstan（已恢复Astana）
{ lat: 29.3759, lon: 47.9774, name_en: 'Kuwait City', name_zh: '科威特城', importance: 1, country_code: 'KWT' }, // Kuwait
{ lat: 42.8746, lon: 74.6122, name_en: 'Bishkek', name_zh: '比什凯克', importance: 1, country_code: 'KGZ' }, // Kyrgyzstan
{ lat: 17.9757, lon: 102.6331, name_en: 'Vientiane', name_zh: '万象', importance: 1, country_code: 'LAO' }, // Laos
{ lat: 33.8938, lon: 35.5018, name_en: 'Beirut', name_zh: '贝鲁特', importance: 1, country_code: 'LBN' }, // Lebanon
{ lat: 3.1390, lon: 101.6869, name_en: 'Kuala Lumpur', name_zh: '吉隆坡', importance: 1, country_code: 'MYS' }, // Malaysia
{ lat: 4.1755, lon: 73.5093, name_en: 'Malé', name_zh: '马累', importance: 1, country_code: 'MDV' }, // Maldives
{ lat: 47.8864, lon: 106.9057, name_en: 'Ulaanbaatar', name_zh: '乌兰巴托', importance: 1, country_code: 'MNG' }, // Mongolia
{ lat: 21.9162, lon: 95.9560, name_en: 'Naypyidaw', name_zh: '内比都', importance: 1, country_code: 'MMR' }, // Myanmar
{ lat: 27.7172, lon: 85.3240, name_en: 'Kathmandu', name_zh: '加德满都', importance: 1, country_code: 'NPL' }, // Nepal
{ lat: 39.0392, lon: 125.7625, name_en: 'Pyongyang', name_zh: '平壤', importance: 1, country_code: 'PRK' }, // North Korea
{ lat: 37.5665, lon: 126.9780, name_en: 'Seoul', name_zh: '首尔', importance: 1, country_code: 'KOR' }, // South Korea
{ lat: 23.6139, lon: 58.5922, name_en: 'Muscat', name_zh: '马斯喀特', importance: 1, country_code: 'OMN' }, // Oman
{ lat: 33.6844, lon: 73.0479, name_en: 'Islamabad', name_zh: '伊斯兰堡', importance: 1, country_code: 'PAK' }, // Pakistan
{ lat: 14.5995, lon: 120.9842, name_en: 'Manila', name_zh: '马尼拉', importance: 1, country_code: 'PHL' }, // Philippines
{ lat: 25.2854, lon: 51.5310, name_en: 'Doha', name_zh: '多哈', importance: 1, country_code: 'QAT' }, // Qatar
{ lat: 24.7136, lon: 46.6753, name_en: 'Riyadh', name_zh: '利雅得', importance: 1, country_code: 'SAU' }, // Saudi Arabia
{ lat: 1.3521, lon: 103.8198, name_en: 'Singapore', name_zh: '新加坡', importance: 1, country_code: 'SGP' }, // Singapore
{ lat: 6.9271, lon: 79.8612, name_en: 'Colombo', name_zh: '科伦坡', importance: 1, country_code: 'LKA' }, // Sri Lanka
{ lat: 33.5138, lon: 36.2765, name_en: 'Damascus', name_zh: '大马士革', importance: 1, country_code: 'SYR' }, // Syria
{ lat: 24.1477, lon: 120.6736, name_en: 'Taipei', name_zh: '台北', importance: 1, country_code: 'TWN' }, // Taiwan
{ lat: 38.5598, lon: 68.7870, name_en: 'Dushanbe', name_zh: '杜尚别', importance: 1, country_code: 'TJK' }, // Tajikistan
{ lat: 13.7563, lon: 100.5018, name_en: 'Bangkok', name_zh: '曼谷', importance: 1, country_code: 'THA' }, // Thailand
{ lat: -8.5569, lon: 125.5603, name_en: 'Dili', name_zh: '帝力', importance: 1, country_code: 'TLS' }, // Timor-Leste
{ lat: 39.9334, lon: 32.8597, name_en: 'Ankara', name_zh: '安卡拉', importance: 1, country_code: 'TUR' }, // Turkey
{ lat: 37.9601, lon: 58.3261, name_en: 'Ashgabat', name_zh: '阿什哈巴德', importance: 1, country_code: 'TKM' }, // Turkmenistan
{ lat: 24.4539, lon: 54.3773, name_en: 'Abu Dhabi', name_zh: '阿布扎比', importance: 1, country_code: 'ARE' }, // United Arab Emirates
{ lat: 41.2995, lon: 69.2401, name_en: 'Tashkent', name_zh: '塔什干', importance: 1, country_code: 'UZB' }, // Uzbekistan
{ lat: 21.0285, lon: 105.8542, name_en: 'Hanoi', name_zh: '河内', importance: 1, country_code: 'VNM' }, // Vietnam
{ lat: 15.3694, lon: 44.1910, name_en: "Sana'a", name_zh: '萨那', importance: 1, country_code: 'YEM' }, // Yemen
{ lat: 55.7558, lon: 37.6173, name_en: 'Moscow', name_zh: '莫斯科', importance: 1, country_code: 'RUS' }, // Russia（地跨欧亚，亚洲部分常规计入）

  // --- 大洋洲首都 ---
  { lat: -9.4438, lon: 147.1803, name_en: 'Port Moresby', name_zh: '莫尔兹比港', importance: 1, country_code: 'PNG' }, // Papua New Guinea
  { lat: -8.5188, lon: 179.1983, name_en: 'Funafuti', name_zh: '富纳富提', importance: 1, country_code: 'TUV' }, // Tuvalu
  { lat: -13.8333, lon: -171.7667, name_en: 'Apia', name_zh: '阿皮亚', importance: 1, country_code: 'WSM' }, // Samoa
  { lat: -21.2078, lon: -175.1982, name_en: 'Nuku\'alofa', name_zh: '努库阿洛法', importance: 1, country_code: 'TON' }, // Tonga
  { lat: 7.4255, lon: 151.85, name_en: 'Palikir', name_zh: '帕利基尔', importance: 1, country_code: 'FSM' }, // Micronesia
  { lat: -9.531, lon: 159.95, name_en: 'Honiara', name_zh: '霍尼亚拉', importance: 1, country_code: 'SLB' }, // Solomon Islands
  { lat: -15.483, lon: 166.95, name_en: 'Port Vila', name_zh: '维拉港', importance: 1, country_code: 'VUT' }, // Vanuatu
  { lat: 7.116, lon: 171.383, name_en: 'Majuro', name_zh: '马朱罗', importance: 1, country_code: 'MHL' }, // Marshall Islands
  { lat: 0.522, lon: 166.931, name_en: 'Yaren', name_zh: '亚伦', importance: 1, country_code: 'NRU' }, // Nauru
  { lat: -0.216, lon: 173.15, name_en: 'South Tarawa', name_zh: '南塔拉瓦', importance: 1, country_code: 'KIR' }, // Kiribati
  { lat: 7.4255, lon: 134.475, name_en: 'Ngerulmud', name_zh: '恩吉鲁穆德', importance: 1, country_code: 'PLW' }, // Palau

    // --- 欧洲首都 ---
  { lat: 41.3275, lon: 19.8187, name_en: 'Tirana', name_zh: '地拉那', importance: 1, country_code: 'ALB' },
  { lat: 42.6629, lon: 21.1655, name_en: 'Pristina', name_zh: '普里什蒂纳', importance: 1, country_code: 'KOS' },
  { lat: 48.2082, lon: 16.3738, name_en: 'Vienna', name_zh: '维也纳', importance: 1, country_code: 'AUT' },
  { lat: 53.9045, lon: 27.5615, name_en: 'Minsk', name_zh: '明斯克', importance: 1, country_code: 'BLR' },
  { lat: 43.8563, lon: 18.4131, name_en: 'Sarajevo', name_zh: '萨拉热窝', importance: 1, country_code: 'BIH' },
  { lat: 42.6977, lon: 23.3219, name_en: 'Sofia', name_zh: '索非亚', importance: 1, country_code: 'BGR' },
  { lat: 45.8150, lon: 15.9819, name_en: 'Zagreb', name_zh: '萨格勒布', importance: 1, country_code: 'HRV' },
  { lat: 50.0755, lon: 14.4378, name_en: 'Prague', name_zh: '布拉格', importance: 1, country_code: 'CZE' },
  { lat: 55.6761, lon: 12.5683, name_en: 'Copenhagen', name_zh: '哥本哈根', importance: 1, country_code: 'DNK' },
  { lat: 59.4370, lon: 24.7536, name_en: 'Tallinn', name_zh: '塔林', importance: 1, country_code: 'EST' },
  { lat: 60.1699, lon: 24.9384, name_en: 'Helsinki', name_zh: '赫尔辛基', importance: 1, country_code: 'FIN' },
  { lat: 37.9838, lon: 23.7275, name_en: 'Athens', name_zh: '雅典', importance: 1, country_code: 'GRC' },
  { lat: 64.1466, lon: -21.9426, name_en: 'Reykjavik', name_zh: '雷克雅未克', importance: 1, country_code: 'ISL' },
  { lat: 56.9496, lon: 24.1052, name_en: 'Riga', name_zh: '里加', importance: 1, country_code: 'LVA' },
  { lat: 47.0169, lon: 9.5228, name_en: 'Vaduz', name_zh: '瓦杜兹', importance: 1, country_code: 'LIE' },
  { lat: 54.6872, lon: 25.2797, name_en: 'Vilnius', name_zh: '维尔纽斯', importance: 1, country_code: 'LTU' },
  { lat: 49.6116, lon: 6.1319, name_en: 'Luxembourg', name_zh: '卢森堡', importance: 1, country_code: 'LUX' },
  { lat: 35.8989, lon: 14.5146, name_en: 'Valletta', name_zh: '瓦莱塔', importance: 1, country_code: 'MLT' },
  { lat: 47.0707, lon: 28.8638, name_en: 'Chișinău', name_zh: '基希讷乌', importance: 1, country_code: 'MDA' },
  { lat: 43.1777, lon: 19.263, name_en: 'Podgorica', name_zh: '波德戈里察', importance: 1, country_code: 'MNE' },
  { lat: 42.0983, lon: 21.4314, name_en: 'Skopje', name_zh: '斯科普里', importance: 1, country_code: 'MKD' },
  { lat: 59.9139, lon: 10.7522, name_en: 'Oslo', name_zh: '奥斯陆', importance: 1, country_code: 'NOR' },
  { lat: 38.7223, lon: -9.1393, name_en: 'Lisbon', name_zh: '里斯本', importance: 1, country_code: 'PRT' },
  { lat: 44.7866, lon: 20.4489, name_en: 'Belgrade', name_zh: '贝尔格莱德', importance: 1, country_code: 'SRB' },
  { lat: 46.0569, lon: 14.5058, name_en: 'Ljubljana', name_zh: '卢布尔雅那', importance: 1, country_code: 'SVN' },
  { lat: 59.3293, lon: 18.0686, name_en: 'Stockholm', name_zh: '斯德哥尔摩', importance: 1, country_code: 'SWE' },
{ lat: 42.5063, lon: 1.5218, name_en: 'Andorra la Vella', name_zh: '安道尔城', importance: 1, country_code: 'AND' },
  { lat: 50.8503, lon: 4.3517, name_en: 'Brussels', name_zh: '布鲁塞尔', importance: 1, country_code: 'BEL' },
  { lat: 35.1796, lon: 33.3823, name_en: 'Nicosia', name_zh: '尼科西亚', importance: 1, country_code: 'CYP' },
  { lat: 48.8566, lon: 2.3522, name_en: 'Paris', name_zh: '巴黎', importance: 1, country_code: 'FRA' },
  { lat: 52.5200, lon: 13.4050, name_en: 'Berlin', name_zh: '柏林', importance: 1, country_code: 'DEU' },
  { lat: 47.4979, lon: 19.0402, name_en: 'Budapest', name_zh: '布达佩斯', importance: 1, country_code: 'HUN' },
  { lat: 53.3498, lon: -6.2603, name_en: 'Dublin', name_zh: '都柏林', importance: 1, country_code: 'IRL' },
  { lat: 41.9028, lon: 12.4964, name_en: 'Rome', name_zh: '罗马', importance: 1, country_code: 'ITA' },
  { lat: 43.7384, lon: 7.4246, name_en: 'Monaco', name_zh: '摩纳哥', importance: 1, country_code: 'MCO' },
  { lat: 52.3676, lon: 4.9041, name_en: 'Amsterdam', name_zh: '阿姆斯特丹', importance: 1, country_code: 'NLD' },
  { lat: 52.2297, lon: 21.0122, name_en: 'Warsaw', name_zh: '华沙', importance: 1, country_code: 'POL' },
  { lat: 44.4268, lon: 26.1025, name_en: 'Bucharest', name_zh: '布加勒斯特', importance: 1, country_code: 'ROU' },
  { lat: 43.9356, lon: 12.4473, name_en: 'San Marino', name_zh: '圣马力诺', importance: 1, country_code: 'SMR' },
  { lat: 48.1486, lon: 17.1077, name_en: 'Bratislava', name_zh: '布拉迪斯拉发', importance: 1, country_code: 'SVK' },
  { lat: 40.4168, lon: -3.7038, name_en: 'Madrid', name_zh: '马德里', importance: 1, country_code: 'ESP' },
  { lat: 46.9480, lon: 7.4474, name_en: 'Bern', name_zh: '伯尔尼', importance: 1, country_code: 'CHE' },
  { lat: 50.4501, lon: 30.5234, name_en: 'Kyiv', name_zh: '基辅', importance: 1, country_code: 'UKR' },
  { lat: 51.5072, lon: -0.1276, name_en: 'London', name_zh: '伦敦', importance: 1, country_code: 'GBR' },
  { lat: 41.9029, lon: 12.4534, name_en: 'Vatican City', name_zh: '梵蒂冈城', importance: 1, country_code: 'VAT' },
  // --- 法国 (扩充) - 高重要性 ---
  { lat: 43.2965, lon: 5.3698, name_en: 'Marseille', name_zh: '马赛', importance: 2, country_code: 'FRA' },
  { lat: 45.7640, lon: 4.8357, name_en: 'Lyon', name_zh: '里昂', importance: 2, country_code: 'FRA' },
  { lat: 43.7102, lon: 7.2620, name_en: 'Nice', name_zh: '尼斯', importance: 2, country_code: 'FRA' },

  // --- 德国 (扩充) - 高重要性 ---
  { lat: 53.5511, lon: 9.9937, name_en: 'Hamburg', name_zh: '汉堡', importance: 2, country_code: 'DEU' },
  { lat: 48.1351, lon: 11.5820, name_en: 'Munich', name_zh: '慕尼黑', importance: 2, country_code: 'DEU' },
  { lat: 50.1109, lon: 8.6821, name_en: 'Frankfurt', name_zh: '法兰克福', importance: 2, country_code: 'DEU' },

  // --- 英国 (扩充) - 高重要性 ---
  { lat: 53.4808, lon: -2.2426, name_en: 'Manchester', name_zh: '曼彻斯特', importance: 2, country_code: 'GBR' },
  { lat: 55.9533, lon: -3.1883, name_en: 'Edinburgh', name_zh: '爱丁堡', importance: 2, country_code: 'GBR' },
  { lat: 51.4816, lon: -3.1791, name_en: 'Cardiff', name_zh: '加的夫', importance: 2, country_code: 'GBR' },



    // --- 北美洲首都 ---
  { lat: 17.1167, lon: -61.85, name_en: 'St. John\'s', name_zh: '圣约翰', importance: 1, country_code: 'ATG' }, // Antigua and Barbuda
  { lat: 13.1058, lon: -59.6132, name_en: 'Bridgetown', name_zh: '布里奇敦', importance: 1, country_code: 'BRB' }, // Barbados
  { lat: 17.4975, lon: -88.1978, name_en: 'Belmopan', name_zh: '贝尔莫潘', importance: 1, country_code: 'BLZ' }, // Belize
  { lat: 9.9281, lon: -84.0907, name_en: 'San José', name_zh: '圣何塞', importance: 1, country_code: 'CRI' }, // Costa Rica
  { lat: 23.1136, lon: -82.3666, name_en: 'Havana', name_zh: '哈瓦那', importance: 1, country_code: 'CUB' }, // Cuba
  { lat: 15.2833, lon: -61.3833, name_en: 'Roseau', name_zh: '罗索', importance: 1, country_code: 'DMA' }, // Dominica
  { lat: 18.4861, lon: -69.9312, name_en: 'Santo Domingo', name_zh: '圣多明各', importance: 1, country_code: 'DOM' }, // Dominican Republic
  { lat: 13.7942, lon: -88.8967, name_en: 'San Salvador', name_zh: '圣萨尔瓦多', importance: 1, country_code: 'SLV' }, // El Salvador
  { lat: 12.05, lon: -61.75, name_en: 'St. George\'s', name_zh: '圣乔治', importance: 1, country_code: 'GRD' }, // Grenada
  { lat: 14.6349, lon: -90.5069, name_en: 'Guatemala City', name_zh: '危地马拉城', importance: 1, country_code: 'GTM' }, // Guatemala
  { lat: 14.4974, lon: -89.6239, name_en: 'Tegucigalpa', name_zh: '特古西加尔巴', importance: 1, country_code: 'HND' }, // Honduras
  { lat: 17.975, lon: -76.794, name_en: 'Kingston', name_zh: '金斯敦', importance: 1, country_code: 'JAM' }, // Jamaica
  { lat: 12.1522, lon: -86.2683, name_en: 'Managua', name_zh: '马那瓜', importance: 1, country_code: 'NIC' }, // Nicaragua
  { lat: 8.9824, lon: -79.5199, name_en: 'Panama City', name_zh: '巴拿马城', importance: 1, country_code: 'PAN' }, // Panama
  { lat: 17.2903, lon: -62.7237, name_en: 'Basseterre', name_zh: '巴斯特尔', importance: 1, country_code: 'KNA' }, // Saint Kitts and Nevis
  { lat: 14.0101, lon: -60.987, name_en: 'Castries', name_zh: '卡斯特里', importance: 1, country_code: 'LCA' }, // Saint Lucia
  { lat: 13.156, lon: -59.617, name_en: 'Kingstown', name_zh: '金斯敦', importance: 1, country_code: 'VCT' }, // Saint Vincent and the Grenadines
  { lat: 10.643, lon: -61.398, name_en: 'Port of Spain', name_zh: '西班牙港', importance: 1, country_code: 'TTO' }, // Trinidad and Tobago



// --- 南美洲首都 ---
  { lat: -34.6037, lon: -58.3816, name_en: 'Buenos Aires', name_zh: '布宜诺斯艾利斯', importance: 1, country_code: 'ARG' }, // Argentina
  { lat: -16.5000, lon: -68.1500, name_en: 'La Paz / Sucre', name_zh: '拉巴斯/苏克雷', importance: 1, country_code: 'BOL' }, // Bolivia
  { lat: -15.7942, lon: -47.8825, name_en: 'Brasília', name_zh: '巴西利亚', importance: 1, country_code: 'BRA' }, // Brazil
  { lat: -33.4489, lon: -70.6693, name_en: 'Santiago', name_zh: '圣地亚哥', importance: 1, country_code: 'CHL' }, // Chile
  { lat: 4.7110, lon: -74.0721, name_en: 'Bogotá', name_zh: '波哥大', importance: 1, country_code: 'COL' }, // Colombia
  { lat: -2.1894, lon: -79.889, name_en: 'Quito', name_zh: '基多', importance: 1, country_code: 'ECU' }, // Ecuador
  { lat: 4.86, lon: -58.93, name_en: 'Georgetown', name_zh: '乔治敦', importance: 1, country_code: 'GUY' }, // Guyana
  { lat: -25.2637, lon: -57.5759, name_en: 'Asunción', name_zh: '亚松森', importance: 1, country_code: 'PRY' }, // Paraguay
  { lat: -12.0464, lon: -77.0428, name_en: 'Lima', name_zh: '利马', importance: 1, country_code: 'PER' }, // Peru
  { lat: 3.864, lon: -55.203, name_en: 'Paramaribo', name_zh: '帕拉马里博', importance: 1, country_code: 'SUR' }, // Suriname
  { lat: -34.9011, lon: -56.1645, name_en: 'Montevideo', name_zh: '蒙得维的亚', importance: 1, country_code: 'URY' }, // Uruguay
  { lat: 10.4806, lon: -66.9036, name_en: 'Caracas', name_zh: '加拉加斯', importance: 1, country_code: 'VEN' }, // Venezuela
  { lat: 4.9382, lon: -52.33, name_en: 'Cayenne', name_zh: '卡宴', importance: 1, country_code: 'GUF' }, // French Guiana

  { lat: 12.305, lon: -61.478, name_en: 'Kingstown', name_zh: '金斯敦', importance: 1, country_code: 'VCT' }, // St. Vincent & Grenadines
  { lat: 42.5063, lon: 1.5218, name_en: 'Andorra la Vella', name_zh: '安道尔城', importance: 1, country_code: 'AND' }, // Andorra
  { lat: 43.7384, lon: 7.4246, name_en: 'Monaco', name_zh: '摩纳哥', importance: 1, country_code: 'MCO' }, // Monaco
  { lat: 43.9356, lon: 12.4473, name_en: 'San Marino', name_zh: '圣马力诺', importance: 1, country_code: 'SMR' }, // San Marino
  { lat: 41.9029, lon: 12.4534, name_en: 'Vatican City', name_zh: '梵蒂冈城', importance: 1, country_code: 'VAT' }, // Vatican City
    { lat: 19.4326, lon: -99.1332, name_en: 'Mexico City', name_zh: '墨西哥城', importance: 1, country_code: 'MEX' },
  { lat: 52.2297, lon: 21.0122, name_en: 'Warsaw', name_zh: '华沙', importance: 1, country_code: 'POL' },
  { lat: 50.4501, lon: 30.5234, name_en: 'Kyiv', name_zh: '基辅', importance: 1, country_code: 'UKR' },

];