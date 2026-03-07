--
-- PostgreSQL database dump
--

\restrict GSYXwazVi0M62IiIrGaSyaKHImwubSlJiQimhQq2iIkN4i6n8PGuR8ldWB4k6ah

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accounttype; Type: TYPE; Schema: public; Owner: gnucash
--

CREATE TYPE public.accounttype AS ENUM (
    'ASSET',
    'LIABILITY',
    'INCOME',
    'EXPENSE',
    'EQUITY',
    'ROOT'
);


ALTER TYPE public.accounttype OWNER TO gnucash;

--
-- Name: bookaccessrole; Type: TYPE; Schema: public; Owner: gnucash
--

CREATE TYPE public.bookaccessrole AS ENUM (
    'VIEWER',
    'EDITOR'
);


ALTER TYPE public.bookaccessrole OWNER TO gnucash;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.accounts (
    id character varying(36) NOT NULL,
    book_id character varying(36) NOT NULL,
    parent_id character varying(36),
    name character varying(120) NOT NULL,
    code character varying(64),
    description character varying(255),
    type public.accounttype NOT NULL,
    commodity_id character varying(36) NOT NULL,
    is_placeholder boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.accounts OWNER TO gnucash;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO gnucash;

--
-- Name: books; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.books (
    id character varying(36) NOT NULL,
    name character varying(120),
    created_at timestamp with time zone NOT NULL,
    is_active boolean NOT NULL,
    default_payables_account_guid character varying(36),
    default_receivables_account_guid character varying(36),
    default_iss_recoverable_account_guid character varying(36)
);


ALTER TABLE public.books OWNER TO gnucash;

--
-- Name: commodities; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.commodities (
    id character varying(36) NOT NULL,
    namespace character varying(32) NOT NULL,
    mnemonic character varying(16) NOT NULL,
    fullname character varying(128),
    fraction integer NOT NULL,
    quote boolean NOT NULL
);


ALTER TABLE public.commodities OWNER TO gnucash;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.customers (
    guid character varying(36) NOT NULL,
    book_id character varying(36) NOT NULL,
    name character varying(2048) NOT NULL,
    id character varying(2048) NOT NULL,
    notes character varying(2048) NOT NULL,
    active boolean NOT NULL,
    discount_num bigint NOT NULL,
    discount_denom bigint NOT NULL,
    credit_num bigint NOT NULL,
    credit_denom bigint NOT NULL,
    currency_guid character varying(36) NOT NULL,
    tax_override boolean NOT NULL,
    addr_name character varying(1024),
    addr_addr1 character varying(1024),
    addr_addr2 character varying(1024),
    addr_addr3 character varying(1024),
    addr_addr4 character varying(1024),
    addr_phone character varying(128),
    addr_fax character varying(128),
    addr_email character varying(256),
    shipaddr_name character varying(1024),
    shipaddr_addr1 character varying(1024),
    shipaddr_addr2 character varying(1024),
    shipaddr_addr3 character varying(1024),
    shipaddr_addr4 character varying(1024),
    shipaddr_phone character varying(128),
    shipaddr_fax character varying(128),
    shipaddr_email character varying(256),
    terms_guid character varying(36),
    tax_included integer,
    taxtable_guid character varying(36),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    income_account_guid character varying(36),
    CONSTRAINT ck_customers_credit_denom_positive CHECK ((credit_denom > 0)),
    CONSTRAINT ck_customers_discount_denom_positive CHECK ((discount_denom > 0))
);


ALTER TABLE public.customers OWNER TO gnucash;

--
-- Name: document_number_counters; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.document_number_counters (
    book_id character varying(36) NOT NULL,
    owner_type character varying(32) NOT NULL,
    next_value integer NOT NULL,
    width integer NOT NULL,
    CONSTRAINT ck_document_number_counters_next_value_positive CHECK ((next_value >= 1)),
    CONSTRAINT ck_document_number_counters_width_positive CHECK ((width >= 1))
);


ALTER TABLE public.document_number_counters OWNER TO gnucash;

--
-- Name: entries; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.entries (
    guid character varying(36) NOT NULL,
    date timestamp with time zone NOT NULL,
    date_entered timestamp with time zone,
    description character varying(2048),
    action character varying(2048),
    notes character varying(2048),
    quantity_num bigint NOT NULL,
    quantity_denom bigint NOT NULL,
    i_acct character varying(36) NOT NULL,
    i_price_num bigint NOT NULL,
    i_price_denom bigint NOT NULL,
    i_discount_num bigint NOT NULL,
    i_discount_denom bigint NOT NULL,
    invoice character varying(36) NOT NULL,
    i_disc_type character varying(32) NOT NULL,
    i_disc_how character varying(32) NOT NULL,
    i_taxable boolean NOT NULL,
    i_taxincluded boolean NOT NULL,
    i_taxtable character varying(36),
    b_paytype integer,
    billable boolean,
    billto_type integer,
    billto_guid character varying(36),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    i_tax_num bigint DEFAULT 0 NOT NULL,
    i_tax_denom bigint DEFAULT 1 NOT NULL,
    CONSTRAINT ck_entries_discount_denom_positive CHECK ((i_discount_denom > 0)),
    CONSTRAINT ck_entries_price_denom_positive CHECK ((i_price_denom > 0)),
    CONSTRAINT ck_entries_quantity_denom_positive CHECK ((quantity_denom > 0)),
    CONSTRAINT ck_entries_tax_denom_positive CHECK ((i_tax_denom > 0))
);


ALTER TABLE public.entries OWNER TO gnucash;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.invoices (
    guid character varying(36) NOT NULL,
    book_id character varying(36) NOT NULL,
    id character varying(2048) NOT NULL,
    invoice_type character varying(32) NOT NULL,
    date_opened timestamp with time zone,
    date_posted timestamp with time zone,
    notes character varying(2048) NOT NULL,
    active boolean NOT NULL,
    currency_guid character varying(36) NOT NULL,
    owner_type character varying(32) NOT NULL,
    owner_guid character varying(36) NOT NULL,
    terms character varying(36),
    billing_id character varying(2048),
    post_txn character varying(36),
    post_lot character varying(36),
    post_acc character varying(36),
    billto_type integer,
    billto_guid character varying(36),
    charge_amt_num bigint,
    charge_amt_denom bigint,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.invoices OWNER TO gnucash;

--
-- Name: lots; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.lots (
    guid character varying(36) NOT NULL,
    account_guid character varying(36) NOT NULL,
    is_closed boolean NOT NULL
);


ALTER TABLE public.lots OWNER TO gnucash;

--
-- Name: slots; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.slots (
    id integer NOT NULL,
    obj_guid character varying(36) NOT NULL,
    name character varying(4096) NOT NULL,
    slot_type integer DEFAULT 10 NOT NULL,
    int64_val bigint,
    string_val character varying(4096),
    timespec_val timestamp with time zone
);


ALTER TABLE public.slots OWNER TO gnucash;

--
-- Name: slots_id_seq; Type: SEQUENCE; Schema: public; Owner: gnucash
--

CREATE SEQUENCE public.slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.slots_id_seq OWNER TO gnucash;

--
-- Name: slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gnucash
--

ALTER SEQUENCE public.slots_id_seq OWNED BY public.slots.id;


--
-- Name: splits; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.splits (
    guid character varying(36) NOT NULL,
    tx_guid character varying(36) NOT NULL,
    account_guid character varying(36) NOT NULL,
    memo character varying(2048) NOT NULL,
    action character varying(2048) NOT NULL,
    reconcile_state character varying(1) NOT NULL,
    reconcile_date timestamp with time zone,
    value_num bigint NOT NULL,
    value_denom bigint NOT NULL,
    quantity_num bigint NOT NULL,
    quantity_denom bigint NOT NULL,
    lot_guid character varying(36),
    CONSTRAINT ck_splits_quantity_denom_positive CHECK ((quantity_denom > 0)),
    CONSTRAINT ck_splits_value_denom_positive CHECK ((value_denom > 0))
);


ALTER TABLE public.splits OWNER TO gnucash;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.transactions (
    guid character varying(36) NOT NULL,
    currency_guid character varying(36) NOT NULL,
    num character varying(2048) NOT NULL,
    post_date timestamp with time zone,
    enter_date timestamp with time zone,
    description character varying(2048)
);


ALTER TABLE public.transactions OWNER TO gnucash;

--
-- Name: user_book_access; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.user_book_access (
    user_id character varying(36) NOT NULL,
    book_id character varying(36) NOT NULL,
    role character varying(6) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT ck_user_book_access_role CHECK (((role)::text = ANY ((ARRAY['VIEWER'::character varying, 'EDITOR'::character varying])::text[])))
);


ALTER TABLE public.user_book_access OWNER TO gnucash;

--
-- Name: users; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.users (
    id character varying(36) NOT NULL,
    email character varying(320) NOT NULL,
    password_hash character varying(512) NOT NULL,
    full_name character varying(120),
    is_active boolean DEFAULT true NOT NULL,
    is_superuser boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


ALTER TABLE public.users OWNER TO gnucash;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: gnucash
--

CREATE TABLE public.vendors (
    guid character varying(36) NOT NULL,
    book_id character varying(36) NOT NULL,
    name character varying(2048) NOT NULL,
    id character varying(2048) NOT NULL,
    notes character varying(2048) NOT NULL,
    currency_guid character varying(36) NOT NULL,
    active boolean NOT NULL,
    tax_override boolean NOT NULL,
    addr_name character varying(1024),
    addr_addr1 character varying(1024),
    addr_addr2 character varying(1024),
    addr_addr3 character varying(1024),
    addr_addr4 character varying(1024),
    addr_phone character varying(128),
    addr_fax character varying(128),
    addr_email character varying(256),
    terms_guid character varying(36),
    tax_inc character varying(2048),
    tax_table_guid character varying(36),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    expense_account_guid character varying(36)
);


ALTER TABLE public.vendors OWNER TO gnucash;

--
-- Name: slots id; Type: DEFAULT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.slots ALTER COLUMN id SET DEFAULT nextval('public.slots_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.accounts (id, book_id, parent_id, name, code, description, type, commodity_id, is_placeholder, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.alembic_version (version_num) FROM stdin;
20260225_0015
\.


--
-- Data for Name: books; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.books (id, name, created_at, is_active, default_payables_account_guid, default_receivables_account_guid, default_iss_recoverable_account_guid) FROM stdin;
\.


--
-- Data for Name: commodities; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.commodities (id, namespace, mnemonic, fullname, fraction, quote) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.customers (guid, book_id, name, id, notes, active, discount_num, discount_denom, credit_num, credit_denom, currency_guid, tax_override, addr_name, addr_addr1, addr_addr2, addr_addr3, addr_addr4, addr_phone, addr_fax, addr_email, shipaddr_name, shipaddr_addr1, shipaddr_addr2, shipaddr_addr3, shipaddr_addr4, shipaddr_phone, shipaddr_fax, shipaddr_email, terms_guid, tax_included, taxtable_guid, created_at, updated_at, income_account_guid) FROM stdin;
\.


--
-- Data for Name: document_number_counters; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.document_number_counters (book_id, owner_type, next_value, width) FROM stdin;
\.


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.entries (guid, date, date_entered, description, action, notes, quantity_num, quantity_denom, i_acct, i_price_num, i_price_denom, i_discount_num, i_discount_denom, invoice, i_disc_type, i_disc_how, i_taxable, i_taxincluded, i_taxtable, b_paytype, billable, billto_type, billto_guid, created_at, updated_at, i_tax_num, i_tax_denom) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.invoices (guid, book_id, id, invoice_type, date_opened, date_posted, notes, active, currency_guid, owner_type, owner_guid, terms, billing_id, post_txn, post_lot, post_acc, billto_type, billto_guid, charge_amt_num, charge_amt_denom, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lots; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.lots (guid, account_guid, is_closed) FROM stdin;
\.


--
-- Data for Name: slots; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.slots (id, obj_guid, name, slot_type, int64_val, string_val, timespec_val) FROM stdin;
\.


--
-- Data for Name: splits; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.splits (guid, tx_guid, account_guid, memo, action, reconcile_state, reconcile_date, value_num, value_denom, quantity_num, quantity_denom, lot_guid) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.transactions (guid, currency_guid, num, post_date, enter_date, description) FROM stdin;
\.


--
-- Data for Name: user_book_access; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.user_book_access (user_id, book_id, role, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.users (id, email, password_hash, full_name, is_active, is_superuser, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: gnucash
--

COPY public.vendors (guid, book_id, name, id, notes, currency_guid, active, tax_override, addr_name, addr_addr1, addr_addr2, addr_addr3, addr_addr4, addr_phone, addr_fax, addr_email, terms_guid, tax_inc, tax_table_guid, created_at, updated_at, expense_account_guid) FROM stdin;
\.


--
-- Name: slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gnucash
--

SELECT pg_catalog.setval('public.slots_id_seq', 1, false);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: commodities commodities_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.commodities
    ADD CONSTRAINT commodities_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (guid);


--
-- Name: document_number_counters document_number_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.document_number_counters
    ADD CONSTRAINT document_number_counters_pkey PRIMARY KEY (book_id, owner_type);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (guid);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (guid);


--
-- Name: lots lots_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_pkey PRIMARY KEY (guid);


--
-- Name: slots slots_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_pkey PRIMARY KEY (id);


--
-- Name: splits splits_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.splits
    ADD CONSTRAINT splits_pkey PRIMARY KEY (guid);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (guid);


--
-- Name: commodities uq_commodity_namespace_mnemonic; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.commodities
    ADD CONSTRAINT uq_commodity_namespace_mnemonic UNIQUE (namespace, mnemonic);


--
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- Name: user_book_access user_book_access_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.user_book_access
    ADD CONSTRAINT user_book_access_pkey PRIMARY KEY (user_id, book_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (guid);


--
-- Name: ix_accounts_book_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_accounts_book_id ON public.accounts USING btree (book_id);


--
-- Name: ix_accounts_book_parent_name; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_accounts_book_parent_name ON public.accounts USING btree (book_id, parent_id, name);


--
-- Name: ix_accounts_commodity_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_accounts_commodity_id ON public.accounts USING btree (commodity_id);


--
-- Name: ix_accounts_name; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_accounts_name ON public.accounts USING btree (name);


--
-- Name: ix_accounts_parent_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_accounts_parent_id ON public.accounts USING btree (parent_id);


--
-- Name: ix_books_default_iss_recoverable_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_books_default_iss_recoverable_account_guid ON public.books USING btree (default_iss_recoverable_account_guid);


--
-- Name: ix_books_default_payables_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_books_default_payables_account_guid ON public.books USING btree (default_payables_account_guid);


--
-- Name: ix_books_default_receivables_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_books_default_receivables_account_guid ON public.books USING btree (default_receivables_account_guid);


--
-- Name: ix_books_is_active; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_books_is_active ON public.books USING btree (is_active);


--
-- Name: ix_commodities_mnemonic; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_commodities_mnemonic ON public.commodities USING btree (mnemonic);


--
-- Name: ix_commodities_namespace; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_commodities_namespace ON public.commodities USING btree (namespace);


--
-- Name: ix_customers_book_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_customers_book_id ON public.customers USING btree (book_id);


--
-- Name: ix_customers_currency_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_customers_currency_guid ON public.customers USING btree (currency_guid);


--
-- Name: ix_customers_income_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_customers_income_account_guid ON public.customers USING btree (income_account_guid);


--
-- Name: ix_entries_i_acct; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_entries_i_acct ON public.entries USING btree (i_acct);


--
-- Name: ix_entries_invoice; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_entries_invoice ON public.entries USING btree (invoice);


--
-- Name: ix_invoices_book_date_opened; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_book_date_opened ON public.invoices USING btree (book_id, date_opened);


--
-- Name: ix_invoices_book_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_book_id ON public.invoices USING btree (book_id);


--
-- Name: ix_invoices_book_owner_type_date_posted; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_book_owner_type_date_posted ON public.invoices USING btree (book_id, owner_type, date_posted);


--
-- Name: ix_invoices_currency_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_currency_guid ON public.invoices USING btree (currency_guid);


--
-- Name: ix_invoices_owner_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_owner_guid ON public.invoices USING btree (owner_guid);


--
-- Name: ix_invoices_post_lot; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_post_lot ON public.invoices USING btree (post_lot);


--
-- Name: ix_invoices_post_txn; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_invoices_post_txn ON public.invoices USING btree (post_txn);


--
-- Name: ix_lots_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_lots_account_guid ON public.lots USING btree (account_guid);


--
-- Name: ix_slots_name; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_slots_name ON public.slots USING btree (name);


--
-- Name: ix_slots_obj_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_slots_obj_guid ON public.slots USING btree (obj_guid);


--
-- Name: ix_slots_obj_guid_name; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_slots_obj_guid_name ON public.slots USING btree (obj_guid, name);


--
-- Name: ix_splits_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_splits_account_guid ON public.splits USING btree (account_guid);


--
-- Name: ix_splits_lot_guid_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_splits_lot_guid_account_guid ON public.splits USING btree (lot_guid, account_guid);


--
-- Name: ix_splits_tx_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_splits_tx_guid ON public.splits USING btree (tx_guid);


--
-- Name: ix_transactions_currency_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_transactions_currency_guid ON public.transactions USING btree (currency_guid);


--
-- Name: ix_transactions_post_date; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_transactions_post_date ON public.transactions USING btree (post_date);


--
-- Name: ix_user_book_access_book_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_user_book_access_book_id ON public.user_book_access USING btree (book_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_is_active; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_users_is_active ON public.users USING btree (is_active);


--
-- Name: ix_vendors_book_id; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_vendors_book_id ON public.vendors USING btree (book_id);


--
-- Name: ix_vendors_currency_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_vendors_currency_guid ON public.vendors USING btree (currency_guid);


--
-- Name: ix_vendors_expense_account_guid; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE INDEX ix_vendors_expense_account_guid ON public.vendors USING btree (expense_account_guid);


--
-- Name: ux_books_single_active; Type: INDEX; Schema: public; Owner: gnucash
--

CREATE UNIQUE INDEX ux_books_single_active ON public.books USING btree (is_active) WHERE (is_active = true);


--
-- Name: accounts accounts_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: accounts accounts_commodity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_commodity_id_fkey FOREIGN KEY (commodity_id) REFERENCES public.commodities(id);


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.accounts(id);


--
-- Name: customers customers_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: customers customers_currency_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_currency_guid_fkey FOREIGN KEY (currency_guid) REFERENCES public.commodities(id);


--
-- Name: customers customers_income_account_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_income_account_guid_fkey FOREIGN KEY (income_account_guid) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: document_number_counters document_number_counters_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.document_number_counters
    ADD CONSTRAINT document_number_counters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: entries entries_i_acct_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_i_acct_fkey FOREIGN KEY (i_acct) REFERENCES public.accounts(id);


--
-- Name: entries entries_invoice_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_invoice_fkey FOREIGN KEY (invoice) REFERENCES public.invoices(guid) ON DELETE CASCADE;


--
-- Name: books fk_books_default_iss_recoverable_account_guid; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT fk_books_default_iss_recoverable_account_guid FOREIGN KEY (default_iss_recoverable_account_guid) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: books fk_books_default_payables_account_guid; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT fk_books_default_payables_account_guid FOREIGN KEY (default_payables_account_guid) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: books fk_books_default_receivables_account_guid; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT fk_books_default_receivables_account_guid FOREIGN KEY (default_receivables_account_guid) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: invoices invoices_currency_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_currency_guid_fkey FOREIGN KEY (currency_guid) REFERENCES public.commodities(id);


--
-- Name: lots lots_account_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_account_guid_fkey FOREIGN KEY (account_guid) REFERENCES public.accounts(id);


--
-- Name: slots slots_obj_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_obj_guid_fkey FOREIGN KEY (obj_guid) REFERENCES public.transactions(guid) ON DELETE CASCADE;


--
-- Name: splits splits_account_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.splits
    ADD CONSTRAINT splits_account_guid_fkey FOREIGN KEY (account_guid) REFERENCES public.accounts(id);


--
-- Name: splits splits_tx_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.splits
    ADD CONSTRAINT splits_tx_guid_fkey FOREIGN KEY (tx_guid) REFERENCES public.transactions(guid) ON DELETE CASCADE;


--
-- Name: transactions transactions_currency_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_currency_guid_fkey FOREIGN KEY (currency_guid) REFERENCES public.commodities(id);


--
-- Name: user_book_access user_book_access_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.user_book_access
    ADD CONSTRAINT user_book_access_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: user_book_access user_book_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.user_book_access
    ADD CONSTRAINT user_book_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: vendors vendors_currency_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_currency_guid_fkey FOREIGN KEY (currency_guid) REFERENCES public.commodities(id);


--
-- Name: vendors vendors_expense_account_guid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gnucash
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_expense_account_guid_fkey FOREIGN KEY (expense_account_guid) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict GSYXwazVi0M62IiIrGaSyaKHImwubSlJiQimhQq2iIkN4i6n8PGuR8ldWB4k6ah

