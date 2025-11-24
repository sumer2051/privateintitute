-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit')),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  credit_limit DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  balance_after DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payees table for bill pay
CREATE TABLE public.payees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_name TEXT NOT NULL,
  account_number TEXT,
  payee_type TEXT CHECK (payee_type IN ('utility', 'credit_card', 'loan', 'other')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scheduled payments table
CREATE TABLE public.scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  payee_id UUID REFERENCES public.payees(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  frequency TEXT CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly')),
  next_payment_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create zelle contacts table
CREATE TABLE public.zelle_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zelle_contacts ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Accounts policies
CREATE POLICY "Users can view own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()));

-- Payees policies
CREATE POLICY "Users can view own payees" ON public.payees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own payees" ON public.payees FOR ALL USING (auth.uid() = user_id);

-- Scheduled payments policies
CREATE POLICY "Users can view own scheduled payments" ON public.scheduled_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own scheduled payments" ON public.scheduled_payments FOR ALL USING (auth.uid() = user_id);

-- Zelle contacts policies
CREATE POLICY "Users can view own contacts" ON public.zelle_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own contacts" ON public.zelle_contacts FOR ALL USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create default accounts
  INSERT INTO public.accounts (user_id, account_type, account_name, account_number, balance, available_balance)
  VALUES 
    (NEW.id, 'checking', 'Checking Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 4582.75, 4582.75),
    (NEW.id, 'savings', 'Savings Account', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 12350.20, 12350.20),
    (NEW.id, 'credit', 'Credit Card', LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), 1245.50, 8754.50);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();