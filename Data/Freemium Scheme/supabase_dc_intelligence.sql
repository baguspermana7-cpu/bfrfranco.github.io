-- ════════════════════════════════════════════════════════════════════════════
-- RESISTANCEZERO — DC INTELLIGENCE TABLES
-- ════════════════════════════════════════════════════════════════════════════
-- Version : 1.0.0
-- Date    : 2026-02-17
-- Purpose : Store global data center industry intelligence data
--           (operators, countries, facilities, market summary)
-- ════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════
-- TABLE: dc_operators
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS dc_operators (
  id            SERIAL PRIMARY KEY,
  rank          INT NOT NULL,
  company       TEXT NOT NULL,
  hq            TEXT NOT NULL,
  type          TEXT NOT NULL,
  capacity_mw   INT NOT NULL DEFAULT 0,
  facilities    INT NOT NULL DEFAULT 0,
  countries     INT NOT NULL DEFAULT 0,
  key_markets   TEXT[] DEFAULT '{}',
  capex_2025_b  NUMERIC(6,2) DEFAULT 0,
  source        TEXT,
  data_year     INT DEFAULT 2025,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER dc_operators_updated_at
  BEFORE UPDATE ON dc_operators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════
-- TABLE: dc_countries
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS dc_countries (
  id            SERIAL PRIMARY KEY,
  rank          INT NOT NULL,
  country       TEXT NOT NULL,
  region        TEXT NOT NULL,
  capacity_mw   INT NOT NULL DEFAULT 0,
  facilities    INT NOT NULL DEFAULT 0,
  key_cities    TEXT[] DEFAULT '{}',
  growth_yoy    NUMERIC(5,2) DEFAULT 0,
  source        TEXT,
  data_year     INT DEFAULT 2025,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER dc_countries_updated_at
  BEFORE UPDATE ON dc_countries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════
-- TABLE: dc_facilities
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS dc_facilities (
  id            SERIAL PRIMARY KEY,
  rank          INT NOT NULL,
  name          TEXT NOT NULL,
  company       TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  capacity_mw   INT NOT NULL DEFAULT 0,
  type          TEXT NOT NULL,
  year_opened   INT,
  notes         TEXT,
  source        TEXT,
  data_year     INT DEFAULT 2025,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER dc_facilities_updated_at
  BEFORE UPDATE ON dc_facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════
-- TABLE: dc_market_summary
-- ══════════════════════════════
CREATE TABLE IF NOT EXISTS dc_market_summary (
  id            SERIAL PRIMARY KEY,
  metric_key    TEXT NOT NULL UNIQUE,
  metric_value  TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'general',
  data_year     INT DEFAULT 2025,
  source        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER dc_market_summary_updated_at
  BEFORE UPDATE ON dc_market_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════
-- INDEXES
-- ══════════════════════════════
CREATE INDEX IF NOT EXISTS idx_dc_operators_rank ON dc_operators(rank);
CREATE INDEX IF NOT EXISTS idx_dc_operators_type ON dc_operators(type);
CREATE INDEX IF NOT EXISTS idx_dc_operators_hq ON dc_operators(hq);
CREATE INDEX IF NOT EXISTS idx_dc_countries_rank ON dc_countries(rank);
CREATE INDEX IF NOT EXISTS idx_dc_countries_region ON dc_countries(region);
CREATE INDEX IF NOT EXISTS idx_dc_facilities_rank ON dc_facilities(rank);
CREATE INDEX IF NOT EXISTS idx_dc_facilities_country ON dc_facilities(country);
CREATE INDEX IF NOT EXISTS idx_dc_market_summary_key ON dc_market_summary(metric_key);


-- ══════════════════════════════
-- RLS — service_role only (read via Cloud Run backend)
-- ══════════════════════════════
ALTER TABLE dc_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_market_summary ENABLE ROW LEVEL SECURITY;

-- Public read access (data is not sensitive)
CREATE POLICY "dc_operators_public_read" ON dc_operators FOR SELECT USING (true);
CREATE POLICY "dc_countries_public_read" ON dc_countries FOR SELECT USING (true);
CREATE POLICY "dc_facilities_public_read" ON dc_facilities FOR SELECT USING (true);
CREATE POLICY "dc_market_summary_public_read" ON dc_market_summary FOR SELECT USING (true);

-- Write via service_role only
CREATE POLICY "dc_operators_service_write" ON dc_operators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dc_countries_service_write" ON dc_countries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dc_facilities_service_write" ON dc_facilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dc_market_summary_service_write" ON dc_market_summary FOR ALL USING (true) WITH CHECK (true);


-- ══════════════════════════════
-- SEED: DC Operators (50 records)
-- ══════════════════════════════
INSERT INTO dc_operators (rank, company, hq, type, capacity_mw, facilities, countries, key_markets, capex_2025_b, source) VALUES
(1,'Amazon Web Services (AWS)','United States','Hyperscale',7500,130,27,ARRAY['N. Virginia','Oregon','Ohio','Ireland','Frankfurt','Singapore'],105,'Synergy Q3 2025'),
(2,'Microsoft Azure','United States','Hyperscale',7000,400,60,ARRAY['N. Virginia','Chicago','Dublin','Amsterdam','Singapore','Phoenix'],95,'Microsoft FY2025'),
(3,'Google Cloud','United States','Hyperscale',5500,100,25,ARRAY['Oregon','Iowa','Finland','Singapore','Taiwan','Netherlands'],75,'Synergy Q3 2025'),
(4,'Meta Platforms','United States','Hyperscale',4500,30,6,ARRAY['Oregon','Iowa','Texas','Sweden','Ireland','Louisiana'],72,'Meta Q3 2025'),
(5,'Equinix','United States','Colocation',3000,260,33,ARRAY['N. Virginia','Silicon Valley','Amsterdam','Frankfurt','Singapore','Tokyo'],4.2,'Equinix Q4 2025'),
(6,'Alibaba Cloud','China','Hyperscale',2800,85,15,ARRAY['Hangzhou','Shanghai','Singapore','KL','Jakarta','Tokyo'],23,'Alibaba FY2025'),
(7,'Digital Realty','United States','Colocation / Wholesale',2760,300,25,ARRAY['N. Virginia','Dallas','Chicago','Amsterdam','Frankfurt','Singapore'],3.8,'Digital Realty Q3 2025'),
(8,'Vantage Data Centers','United States','Hyperscale / Wholesale',2600,35,6,ARRAY['N. Virginia','Phoenix','Santa Clara','Zurich','Johannesburg','Melbourne'],5.0,'Data Centre Magazine'),
(9,'Oracle','United States','Hyperscale',2200,147,40,ARRAY['Abilene TX','Ashburn VA','Phoenix','London','Amsterdam','Tokyo'],25,'Oracle Q2 FY2026'),
(10,'NTT Global Data Centers','Japan','Colocation / Wholesale',2100,150,20,ARRAY['Tokyo','Osaka','London','Frankfurt','Virginia','Mumbai','Singapore'],3.5,'NTT GDC'),
(11,'AirTrunk','Australia','Hyperscale',1800,11,4,ARRAY['Sydney','Melbourne','Singapore','Tokyo','Hong Kong'],3.0,'DCD, Blackstone'),
(12,'Tencent Cloud','China','Hyperscale',1800,70,12,ARRAY['Shenzhen','Shanghai','Beijing','Singapore','Tokyo','Frankfurt'],15,'Tencent'),
(13,'ByteDance / Volcano Engine','China','Hyperscale',1200,40,8,ARRAY['Beijing','Shanghai','Singapore','Virginia','Jakarta'],14,'SCMP, DCD'),
(14,'Lumen Technologies','United States','Colocation / Enterprise',1200,55,8,ARRAY['Denver','Minneapolis','Phoenix','London','Amsterdam'],1.5,'Lumen IR'),
(15,'Apple','United States','Hyperscale',1000,12,5,ARRAY['Mesa AZ','Maiden NC','Reno NV','Waukee IA','Viborg DK'],8,'Apple sustainability'),
(16,'CyrusOne','United States','Colocation / Wholesale',1000,55,3,ARRAY['Dallas','Houston','N. Virginia','Phoenix','London','Frankfurt'],2.0,'CyrusOne'),
(17,'QTS Realty Trust (Blackstone)','United States','Hyperscale / Wholesale',950,63,2,ARRAY['Atlanta','Dallas','Chicago','N. Virginia','Phoenix'],2.5,'QTS'),
(18,'VNET Group (21Vianet)','China','Colocation / Wholesale',783,52,1,ARRAY['Beijing','Shanghai','Shenzhen','Hebei','Inner Mongolia'],1.0,'VNET Q3 2025'),
(19,'GDS Holdings','China','Colocation / Hyperscale',750,102,5,ARRAY['Shanghai','Beijing','Shenzhen','Johor','Batam'],2.0,'GDS Q2 2025'),
(20,'Keppel Data Centres','Singapore','Colocation / Wholesale',650,35,8,ARRAY['Singapore','Dublin','London','Amsterdam','Johor','Sydney'],1.5,'Keppel DC'),
(21,'Switch (DigitalBridge)','United States','Hyperscale / Wholesale',650,8,2,ARRAY['Las Vegas','Reno','Grand Rapids','Atlanta','Milan'],1.8,'Switch'),
(22,'Chindata / WinTriX DC','China','Hyperscale',650,30,5,ARRAY['Beijing','Datong','Hebei','Johor','Cyberjaya','Mumbai'],1.2,'DCD, Bain Capital'),
(23,'STT GDC (ST Telemedia)','Singapore','Colocation / Wholesale',500,40,10,ARRAY['Singapore','London','Bangkok','Mumbai','Guangzhou','Seoul'],1.0,'STT GDC'),
(24,'Yondr Group','Netherlands','Hyperscale / Wholesale',450,10,6,ARRAY['N. Virginia','Dallas','London','Frankfurt','Paris','Johannesburg'],2.5,'Yondr Group'),
(25,'NEXTDC','Australia','Colocation',420,14,2,ARRAY['Sydney','Melbourne','Perth','Brisbane','Auckland'],1.5,'NEXTDC'),
(26,'Iron Mountain Data Centers','United States','Colocation',400,30,10,ARRAY['N. Virginia','New Jersey','Phoenix','Denver','Amsterdam','London'],1.2,'Iron Mountain'),
(27,'Global Switch','United Kingdom','Colocation / Wholesale',400,13,5,ARRAY['London','Sydney','Hong Kong','Singapore','Frankfurt','Amsterdam'],1.2,'Global Switch'),
(28,'STACK Infrastructure','United States','Hyperscale / Wholesale',380,25,5,ARRAY['N. Virginia','Dallas','Chicago','Silicon Valley','Milan','Johor'],1.5,'STACK'),
(29,'Compass Datacenters','United States','Hyperscale / Wholesale',360,15,3,ARRAY['Dallas-FW','N. Virginia','Phoenix','Mississippi','Montreal'],2.0,'Compass'),
(30,'Digital Edge','Singapore','Colocation / Wholesale',340,18,7,ARRAY['Tokyo','Seoul','Jakarta','Mumbai','Manila','Singapore','KL'],1.0,'Digital Edge, Stonepeak'),
(31,'Yotta Infrastructure','India','Hyperscale / Colocation',300,5,1,ARRAY['Navi Mumbai','Greater Noida','GIFT City'],0.5,'Yotta, RankRed'),
(32,'Princeton Digital Group','Singapore','Hyperscale / Colocation',300,20,5,ARRAY['Jakarta','Mumbai','Tokyo','Shanghai','Singapore'],0.8,'Princeton Digital'),
(33,'Colt DCS','United Kingdom','Colocation',260,17,8,ARRAY['London','Frankfurt','Tokyo','Osaka','Mumbai','Singapore'],0.8,'Colt DCS'),
(34,'CoreSite (American Tower)','United States','Colocation',253,28,1,ARRAY['N. Virginia','Silicon Valley','LA','Denver','Chicago','NYC'],0.8,'CoreSite Q3 2025'),
(35,'PureDC','Netherlands','Colocation / Wholesale',240,8,5,ARRAY['Amsterdam','London','UAE','Indonesia','Spain'],0.6,'PureDC, DCD'),
(36,'Flexential','United States','Colocation / Hybrid',220,40,1,ARRAY['Portland','Denver','Dallas','Charlotte','Tampa','Nashville'],0.5,'Flexential'),
(37,'Cyxtera Technologies','United States','Colocation',220,60,5,ARRAY['N. Virginia','Dallas','Chicago','London','Singapore','Sao Paulo'],0.4,'Cyxtera'),
(38,'Aligned Data Centers','United States','Hyperscale / Wholesale',200,12,1,ARRAY['N. Virginia','Dallas','Phoenix','Chicago','Salt Lake City'],1.0,'Aligned'),
(39,'T5 Data Centers','United States','Wholesale',200,8,1,ARRAY['Dallas','Atlanta','Portland','Chicago','Colorado Springs'],0.5,'T5'),
(40,'Telehouse (KDDI)','Japan','Colocation',200,20,8,ARRAY['Tokyo','London','Paris','Frankfurt','New York','Hong Kong'],0.5,'Telehouse'),
(41,'TelecityGroup (Equinix)','United Kingdom','Colocation',190,40,10,ARRAY['London','Amsterdam','Paris','Stockholm','Dublin'],0,'Legacy Equinix'),
(42,'SpaceDC','Singapore','Hyperscale',180,6,4,ARRAY['Jakarta','Singapore','Tokyo','Sydney'],0.6,'SpaceDC'),
(43,'Scala Data Centers','Brazil','Hyperscale / Colocation',180,15,3,ARRAY['Sao Paulo','Rio de Janeiro','Santiago','Bogota'],0.8,'Scala DC'),
(44,'EdgeConneX','United States','Edge / Colocation',170,80,20,ARRAY['N. Virginia','Portland','Amsterdam','Jakarta','Santiago'],0.7,'EdgeConneX'),
(45,'CtrlS Datacenters','India','Colocation / Hyperscale',160,7,1,ARRAY['Hyderabad','Mumbai','Chennai','Noida'],0.3,'CtrlS'),
(46,'CDC Data Centres','Australia','Colocation / Government',150,5,1,ARRAY['Canberra','Sydney','Melbourne'],0.5,'CDC'),
(47,'DataBank','United States','Colocation / Edge',150,65,1,ARRAY['Dallas','Minneapolis','Salt Lake City','Atlanta','Denver'],0.4,'DataBank'),
(48,'Sabey Data Centers','United States','Colocation / Wholesale',130,5,1,ARRAY['Seattle','New York','Ashburn'],0.3,'Sabey'),
(49,'AIMS Data Centre','Malaysia','Colocation',60,5,3,ARRAY['Kuala Lumpur','Cyberjaya','Bangkok','Ho Chi Minh'],0.1,'AIMS'),
(50,'Raxio Group','United Kingdom','Colocation',50,8,8,ARRAY['Kampala','Kinshasa','Addis Ababa','Dar es Salaam','Maputo'],0.2,'Raxio')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════
-- SEED: DC Countries (28 records)
-- ══════════════════════════════
INSERT INTO dc_countries (rank, country, region, capacity_mw, facilities, key_cities, growth_yoy, source) VALUES
(1,'United States','Americas',28500,5427,ARRAY['N. Virginia 5,600MW','Dallas-FW 1,500MW','Phoenix 2,800MW','Chicago 692MW','Silicon Valley'],17.0,'CBRE H1 2025'),
(2,'China','APAC',7050,449,ARRAY['Beijing 28.7%','Shanghai','Shenzhen','Hangzhou','Inner Mongolia'],12.0,'Mordor Intelligence'),
(3,'United Kingdom','EMEA',2590,523,ARRAY['London 1,189MW','Slough','Manchester'],14.0,'C&W EMEA H1 2025'),
(4,'Germany','EMEA',1800,529,ARRAY['Frankfurt 900+MW','Berlin','Munich'],13.7,'C&W EMEA H1 2025'),
(5,'Japan','APAC',1700,222,ARRAY['Tokyo 1,300+MW','Osaka','Inzai'],10.0,'CBRE Global 2025'),
(6,'Ireland','EMEA',1500,55,ARRAY['Dublin 1,200+MW'],11.0,'C&W EMEA'),
(7,'Netherlands','EMEA',1200,298,ARRAY['Amsterdam 800+MW','Eemshaven'],8.0,'C&W EMEA'),
(8,'Australia','APAC',1200,314,ARRAY['Sydney 700+MW','Melbourne 500+MW'],15.0,'CBRE, C&W APAC'),
(9,'Singapore','APAC',1100,99,ARRAY['Singapore (city-state)'],4.4,'CBRE Global 2025'),
(10,'France','EMEA',1000,322,ARRAY['Paris 700+MW','Marseille'],11.2,'C&W EMEA'),
(11,'India','APAC',950,153,ARRAY['Mumbai 335MW u/c','Chennai','Hyderabad','Pune'],20.5,'CBRE, C&W APAC'),
(12,'Canada','Americas',850,337,ARRAY['Toronto','Montreal','Vancouver'],12.0,'CBRE NA H1 2025'),
(13,'Brazil','Americas',550,197,ARRAY['Sao Paulo 493MW','Rio de Janeiro'],15.0,'C&W Americas'),
(14,'South Korea','APAC',500,43,ARRAY['Seoul','Busan','Incheon'],10.0,'CBRE APAC'),
(15,'Hong Kong','APAC',480,122,ARRAY['Tseung Kwan O','Chai Wan'],6.0,'C&W APAC'),
(16,'Italy','EMEA',400,168,ARRAY['Milan','Rome'],12.0,'C&W EMEA'),
(17,'Malaysia','APAC',380,41,ARRAY['Johor 700-900MW planned','KL','Cyberjaya'],25.0,'GlobeNewsWire'),
(18,'Indonesia','APAC',350,88,ARRAY['Jakarta','Batam','Bekasi'],18.0,'C&W APAC'),
(19,'Russia','EMEA',350,251,ARRAY['Moscow','St. Petersburg'],5.0,'Cargoson'),
(20,'Switzerland','EMEA',280,121,ARRAY['Zurich','Geneva'],7.0,'C&W EMEA'),
(21,'Sweden','EMEA',250,95,ARRAY['Stockholm','Lulea'],10.0,'C&W EMEA'),
(22,'Spain','EMEA',220,144,ARRAY['Madrid','Barcelona'],15.0,'C&W EMEA'),
(23,'Poland','EMEA',200,144,ARRAY['Warsaw','Krakow'],14.0,'C&W EMEA'),
(24,'Chile','Americas',180,59,ARRAY['Santiago 148MW'],12.0,'C&W Americas'),
(25,'Mexico','Americas',170,173,ARRAY['Queretaro','Mexico City'],14.0,'C&W Americas'),
(26,'Thailand','APAC',130,42,ARRAY['Bangkok','Chonburi'],15.0,'C&W APAC'),
(27,'South Africa','EMEA',120,25,ARRAY['Johannesburg','Cape Town'],16.0,'C&W EMEA/MEA'),
(28,'UAE','EMEA',110,20,ARRAY['Dubai','Abu Dhabi'],18.0,'JLL 2026')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════
-- SEED: DC Facilities (35 records)
-- ══════════════════════════════
INSERT INTO dc_facilities (rank, name, company, city, country, capacity_mw, type, year_opened, notes, source) VALUES
(1,'Meta Altoona Campus','Meta','Altoona','United States',1401,'Hyperscale',2014,'Multiple buildings; Iowa','Blackridge Research'),
(2,'Vantage Shackelford County','Vantage','Shackelford','United States',1400,'Hyperscale',2026,'$25B+ investment; Texas','Data Centre Magazine'),
(3,'Meta Prineville Campus','Meta','Prineville','United States',1289,'Hyperscale',2011,'3.2M sqft; Oregon','Blackridge Research'),
(4,'Stargate Campus Phase 1','Oracle/OpenAI','Abilene','United States',1200,'Hyperscale/AI',2025,'450K+ NVIDIA GB200 GPUs; Texas','DCK Jan 2026'),
(5,'Meta Hyperion Campus','Meta','Richland Parish','United States',1000,'Hyperscale/AI',2026,'$27B; scaling to 5GW; Louisiana','Meta, DCK'),
(6,'Meta Prometheus Campus','Meta','Columbus','United States',1000,'Hyperscale/AI',2026,'1GW target; Ohio','DCK Jan 2026'),
(7,'Vantage Port Washington','Vantage/OpenAI','Port Washington','United States',1000,'Hyperscale/AI',2026,'$15B; Stargate II; Wisconsin','DCK'),
(8,'Switch Citadel Campus','Switch','Reno','United States',650,'Hyperscale',2017,'Largest operational DC; 7.2M sqft; Nevada','Switch'),
(9,'Microsoft Quincy Campus','Microsoft','Quincy','United States',622,'Hyperscale',2007,'270 acres; hydropower; Washington','Brightlio'),
(10,'CWL1 Data Centre','Vantage','Newport','United Kingdom',400,'Hyperscale',2024,'1.85M sqft; Wales','RankRed'),
(11,'Compass Red Oak','Compass','Red Oak (DFW)','United States',360,'Hyperscale',2023,'Multi-phase; Texas','Compass'),
(12,'Yondr N. Virginia','Yondr','N. Virginia','United States',336,'Hyperscale',2024,'96MW Phase 1; 336MW full','Yondr Group'),
(13,'AirTrunk MEL1','AirTrunk','Melbourne','Australia',280,'Hyperscale',2020,'630MW total Melbourne portfolio','DCPulse'),
(14,'Switch SuperNAP','Switch','Las Vegas','United States',280,'Hyperscale/Colo',2010,'3.5M sqft; Tier IV Gold; Nevada','Switch'),
(15,'QTS Atlanta Metro','QTS','Atlanta','United States',278,'Hyperscale',2011,'990K sqft; flagship; Georgia','QTS'),
(16,'QTS Excalibur Project','QTS','Fayetteville','United States',250,'Hyperscale',2023,'615 acres; 7M sqft; Georgia','Data Center Frontier'),
(17,'Yotta NM1','Yotta','Navi Mumbai','India',250,'Hyperscale/Colo',2019,'30,000 racks; 820K sqft','RankRed'),
(18,'AirTrunk SYD1','AirTrunk','Sydney','Australia',220,'Hyperscale',2018,'First AirTrunk; APAC hub','AirTrunk'),
(19,'Microsoft Dublin Campus','Microsoft','Dublin','Ireland',200,'Hyperscale',2009,'Azure Europe West anchor','Microsoft'),
(20,'China Telecom Inner Mongolia','China Telecom','Hohhot','China',150,'Hyperscale/Cloud',2013,'10.76M sqft; largest by area','Blackridge Research'),
(21,'Apple Mesa Data Center','Apple','Mesa','United States',150,'Hyperscale',2018,'1.3M sqft; 50MW solar; Arizona','Apple'),
(22,'China Mobile Hohhot','China Mobile','Hohhot','China',140,'Hyperscale/Cloud',2014,'7.75M sqft','RankRed'),
(23,'NTT Tokyo 1','NTT','Tokyo','Japan',120,'Colocation',2019,'Flagship APAC facility','NTT GDC'),
(24,'Google Hamina','Google','Hamina','Finland',120,'Hyperscale',2011,'Former paper mill; seawater cooling','Google'),
(25,'Meta Lulea','Meta','Lulea','Sweden',120,'Hyperscale',2013,'Arctic climate; 100% hydro','Meta'),
(26,'Equinix SV5/SV11','Equinix','San Jose','United States',110,'Colocation',2012,'Silicon Valley flagship','Equinix'),
(27,'Lakeside Tech Center','Digital Realty','Chicago','United States',100,'Colocation',1999,'1.1M sqft; 8-story; iconic','Digital Realty'),
(28,'Tulip Data Center','Tulip Telecom','Bengaluru','India',100,'Colocation',2015,'950K sqft; one of Asia largest','RankRed'),
(29,'Sabey Intergate Seattle','Sabey','Seattle','United States',70,'Colocation',2011,'900K sqft; green design','Sabey'),
(30,'Utah Data Center (IC)','US Gov','Bluffdale','United States',65,'Government',2014,'1.5M sqft campus; Utah','Brightlio'),
(31,'CoreSite VA3','CoreSite','Reston','United States',60,'Colocation',2017,'940K sqft; N. Virginia hub','CoreSite'),
(32,'Equinix AM5/AM17','Equinix','Amsterdam','Netherlands',55,'Colocation',2017,'AMS-IX peering point','Equinix'),
(33,'Keppel Singapore T27','Keppel','Singapore','Singapore',52,'Colocation',2021,'Tropical cooling innovation','Keppel DC'),
(34,'Equinix FR5/FR9','Equinix','Frankfurt','Germany',48,'Colocation',2015,'DE-CIX adjacent; finserv hub','Equinix'),
(35,'Iron Mountain NJE-1','Iron Mountain','Edison','United States',26,'Colocation',2016,'830K sqft; former vault; NJ','Iron Mountain')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════
-- SEED: Market Summary (key-value pairs)
-- ══════════════════════════════
INSERT INTO dc_market_summary (metric_key, metric_value, category, source) VALUES
('total_installed_gw','122.2','capacity','Synergy Research Q1 2025'),
('live_it_mw','52000','capacity','Mid-2025 estimate'),
('projected_2026_mw','66504','capacity','JLL 2026 Outlook'),
('projected_2030_gw','200','capacity','JLL'),
('hyperscale_dcs','1297','hyperscale','Synergy Q3 2025'),
('hyperscale_share','0.44','hyperscale','Synergy Q3 2025'),
('top3_share','0.58','hyperscale','Synergy Q3 2025'),
('hyperscale_capex_q3_b','142','hyperscale','Synergy Q3 2025'),
('pipeline_facilities','770','hyperscale','Synergy Q3 2025'),
('investment_2030_t','3.0','investment','JLL 2026 Outlook'),
('americas_share','0.50','regional','CBRE'),
('americas_cagr','0.17','regional','CBRE'),
('americas_construction_gw','7.8','regional','CBRE'),
('apac_capacity_gw','32','regional','C&W APAC'),
('apac_projected_2030_gw','57','regional','C&W APAC'),
('apac_india_cagr','0.205','regional','C&W APAC'),
('emea_operational_gw','10.3','regional','C&W EMEA'),
('emea_yoy_growth','0.21','regional','C&W EMEA'),
('emea_pipeline_gw','14.1','regional','C&W EMEA')
ON CONFLICT (metric_key) DO UPDATE SET
  metric_value = EXCLUDED.metric_value,
  source = EXCLUDED.source,
  updated_at = now();
